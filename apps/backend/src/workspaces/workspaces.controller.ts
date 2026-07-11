import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateWorkspaceDto, InviteMemberDto, UpdateMemberRoleDto } from "./dto";
import { WorkspacesService } from "./workspaces.service";

@UseGuards(JwtAuthGuard)
@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: CurrentUser) {
    return this.workspaces.list(user.id);
  }

  @Get(":id")
  get(@CurrentUser() user: CurrentUser, @Param("id") id: string) {
    return this.workspaces.get(user.id, id);
  }

  @Post(":id/members")
  invite(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: InviteMemberDto) {
    return this.workspaces.invite(user.id, id, dto);
  }

  @Patch(":id/members/:memberId")
  updateRole(
    @CurrentUser() user: CurrentUser,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateMemberRoleDto
  ) {
    return this.workspaces.updateMemberRole(user.id, id, memberId, dto);
  }
}
