import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganisationContextGuard } from "./guards/organisation-context.guard";
import { OrganisationsService } from "./organisations.service";
import type { RequestWithJwtUser } from "../auth/interfaces/request-with-jwt-user.interface";
import { CreateOrganisationDto } from "./dto/create-organisation.dto";
import { UpdateOrganisationDto } from "./dto/update-organisation.dto";
import type { RequestWithJwtAndOrg } from "./interfaces/request-with-org.interface";
import { AddOrganisationMembersDto } from "./dto/add-org-members.dto";
import { UpdateOrgMemberRoleDto } from "./dto/update-org-member-role.dto";

@Controller("organisations")
@UseGuards(JwtAuthGuard)
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  /**
   * POST /organisations
   */
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

  /**
   * GET /organisations
   */
  @Get()
  async listMyOrganisations(@Req() req: RequestWithJwtUser) {
    return this.organisationsService.listUserOrganisations(req.user.userId);
  }

  /**
   * GET /organisations/:slug
   */
  @Get("/:slug")
  async getOrganisationBySlug(@Req() req: RequestWithJwtUser) {
    return this.organisationsService.getOrganisationBySlug(
      req.params.slug,
      req.user.userId,
    );
  }

  /**
   * POST /organisations/members
   */
  @Post("members")
  @UseGuards(OrganisationContextGuard)
  addOrgMembers(
    @Req() req: RequestWithJwtAndOrg,
    @Body() dto: AddOrganisationMembersDto,
  ) {
    return this.organisationsService.addOrganisationMembers(
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      dto,
    );
  }

  /**
   * DELETE /organisations/members/:memberId
   */
  @Delete("members/:memberId")
  @HttpCode(204)
  removeOrgMember(
    @Req() req: RequestWithJwtUser,
    @Param("memberId") memberId: string,
  ) {
    return this.organisationsService.removeOrganisationMember(
      req.user.userId,
      memberId,
    );
  }

  /**
   * PATCH /organisations/members/:memberId
   */
  @Patch("members/:memberId")
  updateOrgMemberRole(
    @Req() req: RequestWithJwtUser,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateOrgMemberRoleDto,
  ) {
    return this.organisationsService.updateOrganisationMemberRole(
      req.user.userId,
      memberId,
      dto.role,
    );
  }

  /**
   * PATCH /organisations/:id
   */
  @Patch(":id")
  update(
    @Req() req: RequestWithJwtUser,
    @Param("id") id: string,
    @Body() dto: UpdateOrganisationDto,
  ) {
    return this.organisationsService.updateOrganisation(req.user.userId, id, dto.name);
  }

  /**
   * DELETE /organisations/:id
   */
  @Delete(":id")
  delete(@Req() req: RequestWithJwtUser, @Param("id") id: string) {
    return this.organisationsService.deleteOrganisation(req.user.userId, id);
  }

  /**
   * GET /organisations/:slug/me
   */
  @Get("/:slug/me")
  getUserOrgDetails(@Req() req: RequestWithJwtUser) {
    return this.organisationsService.getUserOrgDetails(
      req.user.userId,
      req.params.slug,
    );
  }

  /**
   * GET /organisations/:slug/members
   */
  @Get("/:slug/members")
  listOrgMembers(@Req() req: RequestWithJwtUser) {
    return this.organisationsService.listOrganisationMembers(
      req.params.slug,
      req.user.userId,
    );
  }
}
