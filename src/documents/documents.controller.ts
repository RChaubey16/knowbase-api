import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  Get,
  Query,
  Put,
  Delete,
  HttpCode,
} from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestWithJwtUser } from "src/auth/interfaces/request-with-jwt-user.interface";
import { UpdateDocumentDto } from "./dto/update-document.dto";

@Controller("workspaces/:workspaceId/documents")
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async listDocuments(
    @Param("workspaceId") workspaceId: string,
    @Query("limit") limit: string,
    @Req() req: RequestWithJwtUser,
  ) {
    return this.documentsService.listDocuments(
      workspaceId,
      req.user.userId,
      Number(limit) || 20,
    );
  }

  @Get(":documentId")
  async getDocumentById(
    @Param("workspaceId") workspaceId: string,
    @Param("documentId") documentId: string,
    @Req() req: RequestWithJwtUser,
  ) {
    return this.documentsService.getDocumentById(
      workspaceId,
      documentId,
      req.user.userId,
    );
  }

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

  @Put(":documentId")
  async updateDocument(
    @Param("workspaceId") workspaceId: string,
    @Param("documentId") documentId: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: RequestWithJwtUser,
  ) {
    return this.documentsService.updateDocument(
      workspaceId,
      documentId,
      req.user.userId,
      dto,
    );
  }

  @Delete(":documentId")
  @HttpCode(204)
  async archiveDocument(
    @Param("workspaceId") workspaceId: string,
    @Param("documentId") documentId: string,
    @Req() req: RequestWithJwtUser,
  ) {
    await this.documentsService.archiveDocument(
      workspaceId,
      documentId,
      req.user.userId,
    );
  }
}
