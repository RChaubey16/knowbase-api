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
  constructor(private readonly documentsService: DocumentsService) {}

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
