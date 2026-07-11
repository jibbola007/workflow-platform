import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { CreateSprintDto, SprintWorkItemDto, UpdateSprintDto } from "./dto";

const defaultColumns = ["To Do", "In Progress", "Done"];

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService
  ) {}

  async create(userId: string, dto: CreateSprintDto) {
    await this.workspaces.assertRole(userId, dto.workspaceId, ["ADMIN", "MEMBER"]);
    return this.prisma.sprint.create({ data: dto, include: this.include() });
  }

  async list(userId: string, workspaceId?: string) {
    if (!workspaceId) throw new BadRequestException("workspaceId is required");
    await this.workspaces.assertMember(userId, workspaceId);
    return this.prisma.sprint.findMany({
      where: { workspaceId },
      include: this.include(),
      orderBy: { startDate: "desc" }
    });
  }

  async update(userId: string, id: string, dto: UpdateSprintDto) {
    const sprint = await this.getForWrite(userId, id);
    if (dto.status === "ACTIVE" && sprint.status !== "ACTIVE") {
      return this.startSprint(id, dto);
    }
    return this.prisma.sprint.update({ where: { id }, data: dto, include: this.include() });
  }

  async addWorkItem(userId: string, id: string, dto: SprintWorkItemDto) {
    const sprint = await this.getForWrite(userId, id);
    const firstColumn = sprint.board?.columns[0];
    const item = await this.prisma.workItem.findFirst({ where: { id: dto.workItemId, workspaceId: sprint.workspaceId } });
    if (!item) throw new NotFoundException("Work item not found");
    return this.prisma.workItem.update({
      where: { id: dto.workItemId },
      data: { sprintId: id, columnId: firstColumn?.id, status: "TODO" }
    });
  }

  async removeWorkItem(userId: string, id: string, dto: SprintWorkItemDto) {
    const sprint = await this.getForWrite(userId, id);
    const item = await this.prisma.workItem.findFirst({ where: { id: dto.workItemId, workspaceId: sprint.workspaceId } });
    if (!item) throw new NotFoundException("Work item not found");
    return this.prisma.workItem.update({
      where: { id: dto.workItemId },
      data: { sprintId: null, columnId: null, status: "BACKLOG" }
    });
  }

  private async getForWrite(userId: string, id: string) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id }, include: this.include() });
    if (!sprint) throw new NotFoundException("Sprint not found");
    await this.workspaces.assertRole(userId, sprint.workspaceId, ["ADMIN", "MEMBER"]);
    return sprint;
  }

  private async startSprint(id: string, dto: UpdateSprintDto) {
    return this.prisma.$transaction(async (tx) => {
      const sprint = await tx.sprint.update({
        where: { id },
        data: { ...dto, status: "ACTIVE" }
      });

      const existing = await tx.board.findUnique({ where: { sprintId: id } });
      if (!existing) {
        await tx.board.create({
          data: {
            name: `${sprint.name} Board`,
            type: "SPRINT",
            workspaceId: sprint.workspaceId,
            sprintId: sprint.id,
            columns: { create: defaultColumns.map((name, position) => ({ name, position })) }
          }
        });
      }

      return tx.sprint.findUnique({ where: { id }, include: this.include() });
    });
  }

  private include() {
    return {
      workItems: true,
      board: { include: { columns: { orderBy: { position: "asc" as const }, include: { workItems: true } } } }
    };
  }
}
