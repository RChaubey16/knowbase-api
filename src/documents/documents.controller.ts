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

@Controller("workspaces/:workspaceId/documents")
@UseGuards(JwtAuthGuard, OrganisationContextGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  listDocuments(
    @Param("workspaceId") workspaceId: string,
    @Query("limit") limit: string,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    return this.documentsService.listDocuments(
      workspaceId,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      Number(limit) || 20,
    );
  }

  @Get(":documentId")
  getDocumentById(
    @Param("workspaceId") workspaceId: string,
    @Param("documentId") documentId: string,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    return this.documentsService.getDocumentById(
      workspaceId,
      documentId,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
    );
  }

  @Post()
  createDocument(
    @Param("workspaceId") workspaceId: string,
    @Body() dto: CreateDocumentDto,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    return this.documentsService.createDocument(
      workspaceId,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      dto,
    );
  }

  @Put(":documentId")
  updateDocument(
    @Param("workspaceId") workspaceId: string,
    @Param("documentId") documentId: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    return this.documentsService.updateDocument(
      workspaceId,
      documentId,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
      dto,
    );
  }

  @Delete(":documentId")
  @HttpCode(204)
  async archiveDocument(
    @Param("workspaceId") workspaceId: string,
    @Param("documentId") documentId: string,
    @Req() req: RequestWithJwtAndOrg,
  ) {
    await this.documentsService.archiveDocument(
      workspaceId,
      documentId,
      req.organisation.organisationId,
      req.organisation.organisationMemberId,
    );
  }
}
