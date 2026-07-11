import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [CommentsController],
  providers: [CommentsService]
})
export class CommentsModule {}
