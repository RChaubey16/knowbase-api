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
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganisationContextGuard } from "../organisations/guards/organisation-context.guard";
import type { RequestWithJwtAndOrg } from "src/organisations/interfaces/request-with-org.interface";

@Controller("workspaces/:workspace/documents")
@UseGuards(JwtAuthGuard, OrganisationContextGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) { }

  /**
   * GET /workspaces/:workspace/documents
   */
  @Get()
  listDocuments(
    @Param("workspace") workspace: string,
    @Query("limit") limit: string,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    return this.documentsService.listDocuments(
      workspace,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      Number(limit) || 20,
    );
  }

  /**
   * GET /workspaces/:workspace/documents/search
   */
  @Get("search")
  search(
    @Param("workspace") workspace: string,
    @Query("q") query: string,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    if (!query?.trim()) return [];
    return this.documentsService.search(
      query,
      workspace,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
    );
  }

  /**
   * GET /workspaces/:workspace/documents/:documentId
   */
  @Get(":documentId")
  getDocumentById(
    @Param("workspace") workspace: string,
    @Param("documentId") documentId: string,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    return this.documentsService.getDocumentById(
      workspace,
      documentId,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
    );
  }

  /**
   * POST /workspaces/:workspace/documents
   */
  @Post()
  createDocument(
    @Param("workspace") workspace: string,
    @Body() dto: CreateDocumentDto,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    return this.documentsService.createDocument(
      workspace,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      dto,
    );
  }

  /**
   * PUT /workspaces/:workspace/documents/:documentId
   */
  @Put(":documentId")
  updateDocument(
    @Param("workspace") workspace: string,
    @Param("documentId") documentId: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    return this.documentsService.updateDocument(
      workspace,
      documentId,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      dto,
    );
  }

  /**
   * DELETE /workspaces/:slug/:documentId
   */
  @Delete(":documentId")
  @HttpCode(204)
  async archiveDocument(
    @Param("workspace") workspace: string,
    @Param("documentId") documentId: string,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    await this.documentsService.archiveDocument(
      workspace,
      documentId,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
    );
  }
}
