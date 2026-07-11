import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { BoardWorkItemDto, CreateBoardDto, CreateColumnDto, UpdateBoardDto, UpdateColumnDto } from "./dto";

const defaultColumns = ["To Do", "In Progress", "Done"];

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService
  ) {}

  async create(userId: string, dto: CreateBoardDto) {
    await this.workspaces.assertRole(userId, dto.workspaceId, ["ADMIN", "MEMBER"]);
    return this.prisma.board.create({
      data: {
        ...dto,
        columns: { create: defaultColumns.map((name, position) => ({ name, position })) }
      },
      include: this.include()
    });
  }

  async list(userId: string, workspaceId?: string) {
    if (!workspaceId) throw new BadRequestException("workspaceId is required");
    await this.workspaces.assertMember(userId, workspaceId);
    return this.prisma.board.findMany({ where: { workspaceId }, include: this.include(), orderBy: { updatedAt: "desc" } });
  }

  async update(userId: string, id: string, dto: UpdateBoardDto) {
    const board = await this.getForWrite(userId, id);
    return this.prisma.board.update({ where: { id: board.id }, data: dto, include: this.include() });
  }

  async addColumn(userId: string, boardId: string, dto: CreateColumnDto) {
    const board = await this.getForWrite(userId, boardId);
    const count = await this.prisma.boardColumn.count({ where: { boardId: board.id } });
    return this.prisma.boardColumn.create({ data: { boardId, name: dto.name, position: count } });
  }

  async updateColumn(userId: string, boardId: string, columnId: string, dto: UpdateColumnDto) {
    await this.getForWrite(userId, boardId);
    const column = await this.prisma.boardColumn.findFirst({ where: { id: columnId, boardId } });
    if (!column) throw new NotFoundException("Column not found");
    return this.prisma.boardColumn.update({ where: { id: columnId }, data: dto });
  }

  async deleteColumn(userId: string, boardId: string, columnId: string) {
    await this.getForWrite(userId, boardId);
    const column = await this.prisma.boardColumn.findFirst({ where: { id: columnId, boardId } });
    if (!column) throw new NotFoundException("Column not found");
    await this.prisma.workItem.updateMany({ where: { columnId }, data: { columnId: null, status: "BACKLOG" } });
    await this.prisma.boardColumn.delete({ where: { id: columnId } });
    return { deleted: true };
  }

  async moveWorkItem(userId: string, boardId: string, dto: BoardWorkItemDto) {
    const board = await this.getForWrite(userId, boardId);
    const column = await this.prisma.boardColumn.findUnique({ where: { id: dto.columnId } });
    if (!column || column.boardId !== boardId) throw new BadRequestException("Column does not belong to board");

    const status = column.name.toLowerCase().includes("done")
      ? "DONE"
      : column.name.toLowerCase().includes("progress")
        ? "IN_PROGRESS"
        : "TODO";

    const item = await this.prisma.workItem.findFirst({ where: { id: dto.workItemId, workspaceId: board.workspaceId } });
    if (!item) throw new NotFoundException("Work item not found");

    return this.prisma.workItem.update({
      where: { id: dto.workItemId },
      data: { columnId: dto.columnId, status }
    });
  }

  private async getForWrite(userId: string, id: string) {
    const board = await this.prisma.board.findUnique({ where: { id } });
    if (!board) throw new NotFoundException("Board not found");
    await this.workspaces.assertRole(userId, board.workspaceId, ["ADMIN", "MEMBER"]);
    return board;
  }

  private include() {
    return {
      columns: { orderBy: { position: "asc" as const }, include: { workItems: true } },
      sprint: true
    };
  }
}
