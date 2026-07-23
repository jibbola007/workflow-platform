import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BoardWorkItemDto, CreateBoardDto, CreateColumnDto, ReorderColumnsDto, UpdateBoardDto, UpdateColumnDto } from "./dto";
import { BoardsService } from "./boards.service";

@UseGuards(JwtAuthGuard)
@Controller("boards")
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateBoardDto) {
    return this.boards.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: CurrentUser, @Query("workspaceId") workspaceId?: string) {
    return this.boards.list(user.id, workspaceId);
  }

  @Patch(":id")
  update(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: UpdateBoardDto) {
    return this.boards.update(user.id, id, dto);
  }

  @Post(":id/columns")
  addColumn(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: CreateColumnDto) {
    return this.boards.addColumn(user.id, id, dto);
  }

  @Patch(":id/reorder-columns")
  reorderColumns(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: ReorderColumnsDto) {
    return this.boards.reorderColumns(user.id, id, dto.columnIds);
  }

  @Patch(":id/columns/:columnId")
  updateColumn(
    @CurrentUser() user: CurrentUser,
    @Param("id") id: string,
    @Param("columnId") columnId: string,
    @Body() dto: UpdateColumnDto
  ) {
    return this.boards.updateColumn(user.id, id, columnId, dto);
  }

  @Delete(":id/columns/:columnId")
  deleteColumn(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Param("columnId") columnId: string) {
    return this.boards.deleteColumn(user.id, id, columnId);
  }

  @Post(":id/move-card")
  moveCard(@CurrentUser() user: CurrentUser, @Param("id") id: string, @Body() dto: BoardWorkItemDto) {
    return this.boards.moveWorkItem(user.id, id, dto);
  }
}
