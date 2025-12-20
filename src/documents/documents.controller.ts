import { Controller, Post, Param, Body, UseGuards, Req } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestWithJwtUser } from "src/auth/interfaces/request-with-jwt-user.interface";

@Controller("workspaces/:workspaceId/documents")
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async createDocument(
    @Param("workspaceId") workspaceId: string,
    @Body() dto: CreateDocumentDto,
    @Req() req: RequestWithJwtUser,
  ) {
    return this.documentsService.createDocument(
      workspaceId,
      req.user.userId,
      dto,
    );
  }
}
