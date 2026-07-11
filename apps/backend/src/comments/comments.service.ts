import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { CreateCommentDto } from "./dto";

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService
  ) {}

  async create(userId: string, dto: CreateCommentDto) {
    const item = await this.prisma.workItem.findUnique({ where: { id: dto.workItemId } });
    if (!item) throw new NotFoundException("Work item not found");
    await this.workspaces.assertMember(userId, item.workspaceId);
    return this.prisma.comment.create({
      data: { workItemId: dto.workItemId, userId, message: dto.message },
      include: { user: { select: { id: true, name: true } } }
    });
  }
}
