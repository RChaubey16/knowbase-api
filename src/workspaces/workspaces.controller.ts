import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { WorkspacesService } from "./workspaces.service";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganisationContextGuard } from "../organisations/guards/organisation-context.guard";
import type { RequestWithJwtAndOrg } from "src/organisations/interfaces/request-with-org.interface";
import { AddWorkspaceMembersDto } from "./dto/add-workspace-members.dto";

@Controller("workspaces")
@UseGuards(JwtAuthGuard, OrganisationContextGuard)
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
      req.user.userId,
      req.organisation.organisationId,
      dto,
    );
  }

  /**
   * GET /workspaces/:slug
   */
  @Get("/:slug")
  async getWorkspaceBySlug(@Req() req: RequestWithJwtAndOrg) {
    const result = await this.workspacesService.getWorkspaceBySlug(
      req.params.slug,
    );
    return result;
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
   * POST /workspaces/members
   */
  @Post("members")
  addWorkspaceMembers(
    @Req() req: RequestWithJwtAndOrg,
    @Body() dto: AddWorkspaceMembersDto,
  ) {
    return this.workspacesService.addViewers(req.user.userId, dto);
  }
}
