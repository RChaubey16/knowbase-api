import { Module } from "@nestjs/common";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { DemoReadOnlyGuard } from "../auth/guards/demo-readonly.guard";

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, DemoReadOnlyGuard],
})
export class WorkspacesModule {}
