import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { WorkspacesService } from "./workspaces.service";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganisationContextGuard } from "../organisations/guards/organisation-context.guard";
import { DemoReadOnlyGuard } from "../auth/guards/demo-readonly.guard";
import type { RequestWithJwtAndOrg } from "../organisations/interfaces/request-with-org.interface";
import { AddWorkspaceMembersDto } from "./dto/add-workspace-members.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";

@Controller("workspaces")
@UseGuards(JwtAuthGuard, OrganisationContextGuard, DemoReadOnlyGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  /**
   * GET /workspaces
   */
  @Get()
  findAll(@Req() req: RequestWithJwtAndOrg) {
    return this.workspacesService.findAllByOrganisation(
      req.user.userId,
      req.organisation.organisationId,
    );
  }

  /**
   * POST /workspaces
   */
  @Post()
  create(@Req() req: RequestWithJwtAndOrg, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      dto,
    );
  }

  /**
   * GET /workspaces/:slug
   */
  @Get("/:slug")
  async getWorkspaceBySlug(@Req() req: RequestWithJwtAndOrg) {
    return this.workspacesService.getWorkspaceBySlug(
      req.params.slug,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
    );
  }

  /**
   * PATCH /workspaces/:id
   */
  @Patch(":id")
  update(
    @Req() req: RequestWithJwtAndOrg,
    @Param("id") workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.updateWorkspace(
      req.user.userId,
      req.organisation.organisationId,
      workspaceId,
      dto.name,
    );
  }

  /**
   * DELETE /workspaces/:id
   */
  @Delete(":id")
  delete(@Req() req: RequestWithJwtAndOrg, @Param("id") workspaceId: string) {
    return this.workspacesService.deleteWorkspace(
      req.user.userId,
      req.organisation.organisationId,
      workspaceId,
    );
  }

  /**
   * GET /workspaces/:slug/members
   */
  @Get(":slug/members")
  listWorkspaceMembers(@Req() req: RequestWithJwtAndOrg) {
    return this.workspacesService.listWorkspaceMembers(
      req.params.slug,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
    );
  }

  /**
   * DELETE /workspaces/:slug/members/:memberId
   */
  @Delete(":slug/members/:memberId")
  removeWorkspaceMember(
    @Req() req: RequestWithJwtAndOrg,
    @Param("memberId") memberId: string,
  ) {
    return this.workspacesService.removeWorkspaceMember(
      req.params.slug,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      memberId,
    );
  }

  /**
   * POST /workspaces/members
   */
  @Post("members")
  addWorkspaceMembers(
    @Req() req: RequestWithJwtAndOrg,
    @Body() dto: AddWorkspaceMembersDto,
  ) {
    return this.workspacesService.addViewers(
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      dto,
    );
  }

  /**
   * GET /workspaces/:slug/me
   */
  @Get("/:slug/me")
  getUserWorkspaceDetails(@Req() req: RequestWithJwtAndOrg) {
    return this.workspacesService.getUserWorkspaceDetails(
      req.organisation.organisationMemberId,
      req.params.slug,
    );
  }
}
