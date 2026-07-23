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
    return this.prisma.$transaction(async (tx) => {
      const sprint = await tx.sprint.create({ data: dto });
      const columns = await this.getInitialColumns(tx, dto.workspaceId);
      await tx.board.create({
        data: {
          name: `${sprint.name} Board`,
          type: "SPRINT",
          workspaceId: sprint.workspaceId,
          sprintId: sprint.id,
          columns: { create: columns }
        }
      });
      return tx.sprint.findUnique({ where: { id: sprint.id }, include: this.include() });
    });
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
    const { workspaceId, ...cleanData } = dto as any;
    const data: Record<string, any> = { ...cleanData };

    if (dto.status === "COMPLETED" && sprint.status !== "COMPLETED") {
      data.completedAt = new Date();
    }

    if (dto.status === "ACTIVE" && sprint.status !== "ACTIVE") {
      return this.startSprint(id, cleanData);
    }
    return this.prisma.sprint.update({ where: { id }, data, include: this.include() });
  }

  async addWorkItem(userId: string, id: string, dto: SprintWorkItemDto) {
    const sprint = await this.getForWrite(userId, id);
    const item = await this.prisma.workItem.findFirst({ where: { id: dto.workItemId, workspaceId: sprint.workspaceId } });
    if (!item) throw new NotFoundException("Work item not found");

    const columns = sprint.board?.columns ?? [];
    let targetColumnId: string | null = null;
    let targetStatus = item.status;

    if (columns.length > 0) {
      const matchingCol = columns.find((col) => col.name.toLowerCase() === (item.status || "").toLowerCase());
      if (matchingCol) {
        targetColumnId = matchingCol.id;
        targetStatus = matchingCol.name;
      } else {
        targetColumnId = columns[0].id;
        targetStatus = columns[0].name;
      }
    }

    return this.prisma.workItem.update({
      where: { id: dto.workItemId },
      data: { sprintId: id, columnId: targetColumnId, status: targetStatus }
    });
  }

  async removeWorkItem(userId: string, id: string, dto: SprintWorkItemDto) {
    const sprint = await this.getForWrite(userId, id);
    const item = await this.prisma.workItem.findFirst({ where: { id: dto.workItemId, workspaceId: sprint.workspaceId } });
    if (!item) throw new NotFoundException("Work item not found");
    return this.prisma.workItem.update({
      where: { id: dto.workItemId },
      data: { sprintId: null, columnId: null, status: "Backlog" }
    });
  }

  private async getForWrite(userId: string, id: string) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id }, include: this.include() });
    if (!sprint) throw new NotFoundException("Sprint not found");
    await this.workspaces.assertRole(userId, sprint.workspaceId, ["ADMIN", "MEMBER"]);
    return sprint;
  }

  private async startSprint(id: string, dto: UpdateSprintDto) {
    const { workspaceId, ...cleanData } = dto as any;
    return this.prisma.$transaction(async (tx) => {
      const sprint = await tx.sprint.update({
        where: { id },
        data: { ...cleanData, status: "ACTIVE" }
      });

      const existing = await tx.board.findUnique({ where: { sprintId: id } });
      if (!existing) {
        const columns = await this.getInitialColumns(tx, sprint.workspaceId);
        await tx.board.create({
          data: {
            name: `${sprint.name} Board`,
            type: "SPRINT",
            workspaceId: sprint.workspaceId,
            sprintId: sprint.id,
            columns: { create: columns }
          }
        });
      }

      return tx.sprint.findUnique({ where: { id }, include: this.include() });
    });
  }

  private async getInitialColumns(tx: any, workspaceId: string) {
    const latestBoard = await tx.board.findFirst({
      where: { workspaceId, type: "SPRINT" },
      orderBy: { createdAt: "desc" },
      include: {
        columns: {
          orderBy: { position: "asc" }
        }
      }
    });

    if (latestBoard && latestBoard.columns && latestBoard.columns.length > 0) {
      return latestBoard.columns.map((col: any, index: number) => ({
        name: col.name,
        position: index
      }));
    }

    return defaultColumns.map((name, position) => ({ name, position }));
  }

  private workItemInclude() {
    return {
      assignee: { select: { id: true, name: true, email: true } },
      parentEpic: { select: { id: true, title: true, color: true } },
      _count: { select: { children: true } },
      comments: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } }
    };
  }

  private include() {
    return {
      workItems: {
        include: this.workItemInclude(),
        orderBy: [{ position: "asc" as const }, { updatedAt: "desc" as const }]
      },
      board: {
        include: {
          columns: {
            orderBy: { position: "asc" as const },
            include: {
              workItems: {
                include: this.workItemInclude(),
                orderBy: [{ position: "asc" as const }, { updatedAt: "desc" as const }]
              }
            }
          }
        }
      }
    };
  }
}
