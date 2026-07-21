import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { BacklogQueryDto, CreateWorkItemDto, UpdateWorkItemDto } from "./dto";

export function generateWorkspacePrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const p = words.map((w) => w.replace(/[^a-zA-Z0-9]/g, "")[0] || "").join("").toUpperCase().slice(0, 5);
    if (p) return p;
  }
  const clean = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean.slice(0, 2) || "WORK";
}

@Injectable()
export class WorkItemsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService
  ) {}

  async onModuleInit() {
    await this.backfillWorkItemKeys();
  }

  async backfillWorkItemKeys() {
    try {
      const workspaces = await this.prisma.workspace.findMany({
        include: {
          workItems: {
            orderBy: { createdAt: "asc" }
          }
        }
      });

      for (const workspace of workspaces) {
        const prefix = workspace.prefix || generateWorkspacePrefix(workspace.name);
        let counter = workspace.keyCounter || 0;
        let updatedCounter = counter;

        for (const item of workspace.workItems) {
          if (!item.key) {
            counter += 1;
            const key = `${prefix}-${counter}`;
            await this.prisma.workItem.update({
              where: { id: item.id },
              data: { key }
            });
            updatedCounter = counter;
          }
        }

        await this.prisma.workspace.update({
          where: { id: workspace.id },
          data: {
            prefix,
            keyCounter: Math.max(updatedCounter, workspace.keyCounter)
          }
        });
      }
    } catch (err) {
      console.error("Backfill work item keys failed:", err);
    }
  }

  async create(userId: string, dto: CreateWorkItemDto) {
    await this.workspaces.assertRole(userId, dto.workspaceId, ["ADMIN", "MEMBER"]);
    if (dto.parentEpicId) await this.assertEpic(dto.workspaceId, dto.parentEpicId);

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.update({
        where: { id: dto.workspaceId },
        data: { keyCounter: { increment: 1 } }
      });

      const prefix = workspace.prefix || generateWorkspacePrefix(workspace.name);
      if (!workspace.prefix) {
        await tx.workspace.update({
          where: { id: dto.workspaceId },
          data: { prefix }
        });
      }

      const key = `${prefix}-${workspace.keyCounter}`;
      const last = await tx.workItem.aggregate({
        where: { workspaceId: dto.workspaceId, sprintId: dto.sprintId ?? null },
        _max: { position: true }
      });

      let color: string | undefined = undefined;
      if (dto.type === "EPIC") {
        const epicCount = await tx.workItem.count({ where: { workspaceId: dto.workspaceId, type: "EPIC" } });
        const EPIC_COLORS = ["purple", "blue", "emerald", "amber", "rose", "teal", "pink", "indigo", "cyan", "orange"];
        color = EPIC_COLORS[epicCount % EPIC_COLORS.length];
      }

      return tx.workItem.create({
        data: {
          ...dto,
          key,
          color,
          position: (last._max.position ?? -1) + 1
        },
        include: this.include()
      });
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
            { description: { contains: query.search, mode: "insensitive" } },
            { key: { contains: query.search, mode: "insensitive" } }
          ]
        : undefined
    };

    return this.prisma.workItem.findMany({
      where,
      include: this.include(),
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }]
    });
  }

  async backlog(userId: string, query: BacklogQueryDto) {
    await this.workspaces.assertMember(userId, query.workspaceId);
    return this.prisma.workItem.findMany({
      where: {
        workspaceId: query.workspaceId,
        sprintId: null,
        assigneeId: query.assigneeId,
        status: query.status,
        parentEpicId: query.epicId,
        type: { not: "EPIC" }
      },
      include: this.include(),
      orderBy: [{ position: "asc" }, { createdAt: "asc" }]
    });
  }

  async reorderBacklog(userId: string, workItemIds: string[]) {
    if (new Set(workItemIds).size !== workItemIds.length) {
      throw new BadRequestException("workItemIds must not contain duplicates");
    }
    const items = await this.prisma.workItem.findMany({ where: { id: { in: workItemIds } } });
    if (items.length !== workItemIds.length) throw new NotFoundException("One or more work items were not found");
    const workspaceId = items[0].workspaceId;
    if (items.some((item) => item.workspaceId !== workspaceId || item.sprintId !== null)) {
      throw new BadRequestException("Only backlog items from one workspace can be reordered");
    }
    await this.workspaces.assertRole(userId, workspaceId, ["ADMIN", "MEMBER"]);
    await this.prisma.$transaction(
      workItemIds.map((id, position) => this.prisma.workItem.update({ where: { id }, data: { position } }))
    );
    return this.prisma.workItem.findMany({ where: { id: { in: workItemIds } }, include: this.include(), orderBy: { position: "asc" } });
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
    if (dto.parentEpicId === id) throw new BadRequestException("A work item cannot be its own epic");
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
    let unlinkedChildrenCount = 0;
    if (item.type === "EPIC") {
      const res = await this.prisma.workItem.updateMany({
        where: { parentEpicId: id },
        data: { parentEpicId: null }
      });
      unlinkedChildrenCount = res.count;
    }
    await this.prisma.workItem.delete({ where: { id } });
    return { deleted: true, id, unlinkedChildrenCount };
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
      const ordered = await tx.workItem.findMany({ where: scope, orderBy: { position: "asc" } });
      const ids = ordered.filter((entry) => entry.id !== id).map((entry) => entry.id);
      if (destination === "TOP") ids.unshift(id); else ids.push(id);
      await Promise.all(ids.map((entryId, position) => tx.workItem.update({ where: { id: entryId }, data: { position } })));
      return tx.workItem.findUniqueOrThrow({ where: { id }, include: this.include() });
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
      parentEpic: { select: { id: true, title: true, color: true } },
      _count: { select: { children: true } },
      comments: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } }
    };
  }
}
