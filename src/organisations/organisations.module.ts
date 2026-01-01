import { Module } from "@nestjs/common";
import { OrganisationsService } from "./organisations.service";
import { OrganisationsController } from "./organisations.controller";
import { OrganisationResolverService } from "./organisation-resolver.service";

@Module({
  controllers: [OrganisationsController],
  providers: [OrganisationsService, OrganisationResolverService],
  exports: [OrganisationsService, OrganisationResolverService],
})
export class OrganisationsModule {}
