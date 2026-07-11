import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateWorkspaceDto, InviteMemberDto, UpdateMemberRoleDto } from "./dto";

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({
      data: {
        name: dto.name,
        members: { create: { userId, role: "ADMIN" } }
      },
      include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } }
    });
  }

  list(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: { members: true, _count: { select: { workItems: true, sprints: true, boards: true } } },
      orderBy: { updatedAt: "desc" }
    });
  }

  async get(userId: string, id: string) {
    await this.assertMember(userId, id);
    return this.prisma.workspace.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { workItems: true, sprints: true, boards: true } }
      }
    });
  }

  async invite(userId: string, workspaceId: string, dto: InviteMemberDto) {
    await this.assertRole(userId, workspaceId, ["ADMIN"]);
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) throw new NotFoundException("User must register before being added to a workspace");

    return this.prisma.workspaceMember.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
      update: { role: dto.role ?? "MEMBER" },
      create: { userId: user.id, workspaceId, role: dto.role ?? "MEMBER" }
    });
  }

  async updateMemberRole(userId: string, workspaceId: string, memberId: string, dto: UpdateMemberRoleDto) {
    await this.assertRole(userId, workspaceId, ["ADMIN"]);
    const member = await this.prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!member) throw new NotFoundException("Workspace member not found");
    return this.prisma.workspaceMember.update({ where: { id: memberId }, data: { role: dto.role } });
  }

  async assertMember(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } }
    });
    if (!member) throw new ForbiddenException("You do not have access to this workspace");
    return member;
  }

  async assertRole(userId: string, workspaceId: string, roles: WorkspaceRole[]) {
    const member = await this.assertMember(userId, workspaceId);
    if (!roles.includes(member.role)) throw new ForbiddenException("You do not have permission for this action");
    return member;
  }
}
