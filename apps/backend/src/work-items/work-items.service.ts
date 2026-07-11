import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { CreateWorkItemDto, UpdateWorkItemDto } from "./dto";

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService
  ) {}

  async create(userId: string, dto: CreateWorkItemDto) {
    await this.workspaces.assertRole(userId, dto.workspaceId, ["ADMIN", "MEMBER"]);
    if (dto.parentEpicId) await this.assertEpic(dto.workspaceId, dto.parentEpicId);

    const last = await this.prisma.workItem.aggregate({ where: { workspaceId: dto.workspaceId, sprintId: dto.sprintId ?? null }, _max: { position: true } });
    return this.prisma.workItem.create({
      data: { ...dto, position: (last._max.position ?? -1) + 1 },
      include: this.include()
    });
  }

  async list(userId: string, query: Record<string, string | undefined>) {
    const workspaceId = query.workspaceId;
    if (!workspaceId) throw new BadRequestException("workspaceId is required");
    await this.workspaces.assertMember(userId, workspaceId);

    const where: Prisma.WorkItemWhereInput = {
      workspaceId,
      type: query.type as never,
      priority: query.priority as never,
      status: query.status as never,
      sprintId: query.sprintId,
      columnId: query.columnId,
      OR: query.search
        ? [
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } }
          ]
        : undefined
    };

    return this.prisma.workItem.findMany({
      where,
      include: this.include(),
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }]
    });
  }

  async backlog(userId: string, workspaceId?: string, assigneeId?: string) {
    if (!workspaceId) throw new BadRequestException("workspaceId is required");
    await this.workspaces.assertMember(userId, workspaceId);
    return this.prisma.workItem.findMany({
      where: { workspaceId, sprintId: null, assigneeId: assigneeId || undefined },
      include: this.include(),
      orderBy: [{ position: "asc" }, { createdAt: "asc" }]
    });
  }

  async get(userId: string, id: string) {
    const item = await this.prisma.workItem.findUnique({ where: { id }, include: this.include() });
    if (!item) throw new NotFoundException("Work item not found");
    await this.workspaces.assertMember(userId, item.workspaceId);
    return item;
  }

  async update(userId: string, id: string, dto: UpdateWorkItemDto) {
    const item = await this.get(userId, id);
    await this.workspaces.assertRole(userId, item.workspaceId, ["ADMIN", "MEMBER"]);
    if (dto.parentEpicId) await this.assertEpic(item.workspaceId, dto.parentEpicId);
    if (dto.assigneeId) await this.assertWorkspaceAssignee(item.workspaceId, dto.assigneeId);

    return this.prisma.workItem.update({
      where: { id },
      data: dto,
      include: this.include()
    });
  }

  async delete(userId: string, id: string) {
    const item = await this.get(userId, id);
    await this.workspaces.assertRole(userId, item.workspaceId, ["ADMIN", "MEMBER"]);
    await this.prisma.workItem.delete({ where: { id } });
    return { deleted: true };
  }

  async updateAssignee(userId: string, id: string, assigneeId: string | null) {
    const item = await this.getForWrite(userId, id);
    if (assigneeId) await this.assertWorkspaceAssignee(item.workspaceId, assigneeId);
    return this.prisma.workItem.update({ where: { id }, data: { assigneeId }, include: this.include() });
  }

  async updateEstimate(userId: string, id: string, estimate: number | null) {
    await this.getForWrite(userId, id);
    return this.prisma.workItem.update({ where: { id }, data: { estimate }, include: this.include() });
  }

  async updateStatus(userId: string, id: string, status: Prisma.WorkItemUpdateInput["status"]) {
    await this.getForWrite(userId, id);
    return this.prisma.workItem.update({ where: { id }, data: { status }, include: this.include() });
  }

  async updateDescription(userId: string, id: string, description: string | null) {
    await this.getForWrite(userId, id);
    return this.prisma.workItem.update({ where: { id }, data: { description }, include: this.include() });
  }

  async moveToSprint(userId: string, id: string, sprintId: string | null) {
    const item = await this.getForWrite(userId, id);
    if (!sprintId) return this.prisma.workItem.update({ where: { id }, data: { sprintId: null, columnId: null, status: "BACKLOG" }, include: this.include() });
    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, workspaceId: item.workspaceId }, include: { board: { include: { columns: { orderBy: { position: "asc" } } } } } });
    if (!sprint) throw new BadRequestException("Sprint must belong to this workspace");
    return this.prisma.workItem.update({ where: { id }, data: { sprintId, columnId: sprint.board?.columns[0]?.id, status: "TODO" }, include: this.include() });
  }

  async movePosition(userId: string, id: string, destination: "TOP" | "BOTTOM") {
    const item = await this.getForWrite(userId, id);
    const scope = { workspaceId: item.workspaceId, sprintId: item.sprintId };
    return this.prisma.$transaction(async (tx) => {
      const edge = await tx.workItem.aggregate({ where: scope, _min: { position: true }, _max: { position: true } });
      const position = destination === "TOP" ? (edge._min.position ?? 0) - 1 : (edge._max.position ?? -1) + 1;
      return tx.workItem.update({ where: { id }, data: { position }, include: this.include() });
    });
  }

  private async getForWrite(userId: string, id: string) {
    const item = await this.get(userId, id);
    await this.workspaces.assertRole(userId, item.workspaceId, ["ADMIN", "MEMBER"]);
    return item;
  }

  private async assertWorkspaceAssignee(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } });
    if (!member) throw new BadRequestException("Assignee must be a workspace member");
  }

  private async assertEpic(workspaceId: string, parentEpicId: string) {
    const epic = await this.prisma.workItem.findFirst({
      where: { id: parentEpicId, workspaceId, type: "EPIC" }
    });
    if (!epic) throw new BadRequestException("parentEpicId must reference an epic in this workspace");
  }

  private include() {
    return {
      assignee: { select: { id: true, name: true, email: true } },
      parentEpic: { select: { id: true, title: true } },
      comments: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } }
    };
  }
}
