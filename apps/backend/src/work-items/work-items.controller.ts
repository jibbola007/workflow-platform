import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BacklogQueryDto, CreateWorkItemDto, MoveWorkItemPositionDto, MoveWorkItemToSprintDto, ReorderBacklogDto, UpdateAssigneeDto, UpdateDescriptionDto, UpdateEstimateDto, UpdateStatusDto, UpdateWorkItemDto } from "./dto";
import { WorkItemsService } from "./work-items.service";

@UseGuards(JwtAuthGuard)
@Controller("work-items")
export class WorkItemsController {
  constructor(private readonly workItems: WorkItemsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateWorkItemDto) {
    return this.workItems.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: CurrentUser, @Query() query: Record<string, string | undefined>) {
    return this.workItems.list(user.id, query);
  }

  @Get("backlog")
  backlog(@CurrentUser() user: CurrentUser, @Query() query: BacklogQueryDto) {
    return this.workItems.backlog(user.id, query);
  }

  @Patch("backlog/order")
  reorderBacklog(@CurrentUser() user: CurrentUser, @Body() dto: ReorderBacklogDto) {
    return this.workItems.reorderBacklog(user.id, dto.workItemIds);
  }

  @Get(":id")
  get(@CurrentUser() user: CurrentUser, @Param("id") id: string) {
    return this.workItems.get(user.id, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: UpdateWorkItemDto) {
    console.log("PATCH /work-items/:id DTO RECEIVED:", dto);
    return this.workItems.update(user.id, id, dto);
  }

  @Patch(":id/assignee")
  updateAssignee(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: UpdateAssigneeDto) { return this.workItems.updateAssignee(user.id, id, dto.assigneeId ?? null); }
  @Patch(":id/estimate")
  updateEstimate(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: UpdateEstimateDto) { return this.workItems.updateEstimate(user.id, id, dto.estimate ?? null); }
  @Patch(":id/status")
  updateStatus(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: UpdateStatusDto) { return this.workItems.updateStatus(user.id, id, dto.status); }
  @Patch(":id/description")
  updateDescription(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: UpdateDescriptionDto) { return this.workItems.updateDescription(user.id, id, dto.description ?? null); }
  @Patch(":id/sprint")
  moveToSprint(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: MoveWorkItemToSprintDto) { return this.workItems.moveToSprint(user.id, id, dto.sprintId ?? null); }
  @Patch(":id/position")
  movePosition(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: MoveWorkItemPositionDto) { return this.workItems.movePosition(user.id, id, dto.position); }

  @Delete(":id")
  delete(@CurrentUser() user: CurrentUser, @Param("id") id: string) {
    return this.workItems.delete(user.id, id);
  }
}
