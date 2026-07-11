import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { SprintsController } from "./sprints.controller";
import { SprintsService } from "./sprints.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [SprintsController],
  providers: [SprintsService]
})
export class SprintsModule {}
