import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { WorkspacesService } from "./workspaces.service";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestWithJwtUser } from "../auth/interfaces/request-with-jwt-user.interface";

@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @UseGuards(JwtAuthGuard)
  @Post("create")
  create(
    @Req() req: RequestWithJwtUser,
    @Body() createWorkspaceDto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.create(req.user.userId, createWorkspaceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("all")
  findAll(@Req() req: RequestWithJwtUser) {
    return this.workspacesService.findAllWorkspacesByUser(req.user.userId);
  }
}
