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
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DocumentsService } from "./documents.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganisationContextGuard } from "../organisations/guards/organisation-context.guard";
import type { RequestWithJwtAndOrg } from "src/organisations/interfaces/request-with-org.interface";

@Controller("workspaces/:workspace/documents")
@UseGuards(JwtAuthGuard, OrganisationContextGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

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
    @Query("mode") mode: string,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    if (!query?.trim()) return [];
    return this.documentsService.search(
      query,
      mode ?? "simple",
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
   * POST /workspaces/:workspace/documents/upload
   */
  @Post("upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadPdf(
    @Param("workspace") workspace: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("title") title: string,
    @Body("isIndexed") isIndexed: string,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    if (!title?.trim()) throw new BadRequestException("Title is required");
    return this.documentsService.uploadPdf(
      workspace,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      file,
      title,
      isIndexed === "true",
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
   * POST /workspaces/:workspace/documents/:documentId/reindex
   */
  @Post(":documentId/reindex")
  @HttpCode(HttpStatus.ACCEPTED)
  async reindexDocument(
    @Param("workspace") workspace: string,
    @Param("documentId") documentId: string,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    await this.documentsService.reindexDocument(
      workspace,
      documentId,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
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
