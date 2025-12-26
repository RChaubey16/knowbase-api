import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganisationsService } from "./organisations.service";
import type { RequestWithJwtUser } from "../auth/interfaces/request-with-jwt-user.interface";
import { CreateOrganisationDto } from "./dto/create-organisation.dto";

@Controller("organisations")
@UseGuards(JwtAuthGuard)
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  @Post()
  async createOrganisation(
    @Req() req: RequestWithJwtUser,
    @Body() dto: CreateOrganisationDto,
  ) {
    return this.organisationsService.createOrganisation(
      req.user.userId,
      dto.name,
      dto.slug,
    );
  }

  @Get()
  async listMyOrganisations(@Req() req: RequestWithJwtUser) {
    return this.organisationsService.listUserOrganisations(req.user.userId);
  }

  @Get("/:slug")
  async getOrganisationBySlug(@Req() req: RequestWithJwtUser) {
    const result = await this.organisationsService.getOrganisationBySlug(
      req.params.slug,
    );
    return result;
  }
}
