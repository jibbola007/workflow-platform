import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateSprintDto, SprintWorkItemDto, UpdateSprintDto } from "./dto";
import { SprintsService } from "./sprints.service";

@UseGuards(JwtAuthGuard)
@Controller("sprints")
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateSprintDto) {
    return this.sprints.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: CurrentUser, @Query("workspaceId") workspaceId?: string) {
    return this.sprints.list(user.id, workspaceId);
  }

  @Patch(":id")
  update(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: UpdateSprintDto) {
    return this.sprints.update(user.id, id, dto);
  }

  @Post(":id/work-items")
  addWorkItem(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: SprintWorkItemDto) {
    return this.sprints.addWorkItem(user.id, id, dto);
  }

  @Post(":id/work-items/remove")
  removeWorkItem(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: SprintWorkItemDto) {
    return this.sprints.removeWorkItem(user.id, id, dto);
  }
}
