import { Module } from "@nestjs/common";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { OrganisationResolverService } from "src/organisations/organisation-resolver.service";

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, OrganisationResolverService],
})
export class WorkspacesModule {}
