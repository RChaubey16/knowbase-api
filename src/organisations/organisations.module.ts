import { Module } from "@nestjs/common";
import { OrganisationsService } from "./organisations.service";
import { OrganisationsController } from "./organisations.controller";
import { DemoReadOnlyGuard } from "../auth/guards/demo-readonly.guard";

@Module({
  controllers: [OrganisationsController],
  providers: [OrganisationsService, DemoReadOnlyGuard],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}
