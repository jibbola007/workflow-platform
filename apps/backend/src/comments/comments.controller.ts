import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto";

@UseGuards(JwtAuthGuard)
@Controller("comments")
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateCommentDto) {
    return this.comments.create(user.id, dto);
  }
}
