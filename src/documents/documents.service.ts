import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
} from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, isNull, desc } from "drizzle-orm";
import * as schema from "../db/schema";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";

@Injectable()
export class DocumentsService {
  constructor(
    @Inject("DB")
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async createDocument(
    workspaceId: string,
    organisationId: string,
    organisationMemberId: string,
    dto: CreateDocumentDto,
  ) {
    await this.assertWorkspaceAccess(
      workspaceId,
      organisationId,
      organisationMemberId,
    );

    const [document] = await this.db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(schema.documents)
        .values({
          workspaceId,
          createdBy: organisationMemberId,
          title: dto.title.trim(),
          type: "text",
          status: "ready",
          source: "manual",
        })
        .returning();

      await tx.insert(schema.documentContents).values({
        documentId: doc.id,
        rawContent: dto.content,
      });

      return [doc];
    });

    return document;
  }

  async listDocuments(
    workspaceId: string,
    organisationId: string,
    organisationMemberId: string,
    limit: number,
  ) {
    await this.assertWorkspaceAccess(
      workspaceId,
      organisationId,
      organisationMemberId,
    );

    const safeLimit = Math.min(limit, 50);

    return {
      items: await this.db
        .select({
          id: schema.documents.id,
          title: schema.documents.title,
          type: schema.documents.type,
          status: schema.documents.status,
          createdAt: schema.documents.createdAt,
          updatedAt: schema.documents.updatedAt,
        })
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.workspaceId, workspaceId),
            isNull(schema.documents.archivedAt),
          ),
        )
        .orderBy(desc(schema.documents.updatedAt))
        .limit(safeLimit),
    };
  }

  async getDocumentById(
    workspaceId: string,
    documentId: string,
    organisationId: string,
    organisationMemberId: string,
  ) {
    await this.assertWorkspaceAccess(
      workspaceId,
      organisationId,
      organisationMemberId,
    );

    const result = await this.db
      .select({
        id: schema.documents.id,
        title: schema.documents.title,
        type: schema.documents.type,
        status: schema.documents.status,
        createdAt: schema.documents.createdAt,
        updatedAt: schema.documents.updatedAt,
        content: schema.documentContents.rawContent,
      })
      .from(schema.documents)
      .innerJoin(
        schema.documentContents,
        eq(schema.documents.id, schema.documentContents.documentId),
      )
      .where(
        and(
          eq(schema.documents.id, documentId),
          eq(schema.documents.workspaceId, workspaceId),
          isNull(schema.documents.archivedAt),
        ),
      )
      .limit(1);

    if (!result.length) {
      throw new NotFoundException("Document not found");
    }

    return result[0];
  }

  async updateDocument(
    workspaceId: string,
    documentId: string,
    organisationId: string,
    organisationMemberId: string,
    dto: UpdateDocumentDto,
  ) {
    await this.assertWorkspaceAccess(
      workspaceId,
      organisationId,
      organisationMemberId,
    );

    const updated = await this.db.transaction(async (tx) => {
      const [doc] = await tx
        .update(schema.documents)
        .set({
          title: dto.title.trim(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.documents.id, documentId),
            eq(schema.documents.workspaceId, workspaceId),
            isNull(schema.documents.archivedAt),
          ),
        )
        .returning();

      if (!doc) {
        throw new NotFoundException("Document not found");
      }

      await tx
        .update(schema.documentContents)
        .set({
          rawContent: dto.content,
          updatedAt: new Date(),
        })
        .where(eq(schema.documentContents.documentId, documentId));

      return doc;
    });

    return updated;
  }

  async archiveDocument(
    workspaceId: string,
    documentId: string,
    organisationId: string,
    organisationMemberId: string,
  ) {
    await this.assertWorkspaceAccess(
      workspaceId,
      organisationId,
      organisationMemberId,
    );

    const result = await this.db
      .update(schema.documents)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(schema.documents.id, documentId),
          eq(schema.documents.workspaceId, workspaceId),
          isNull(schema.documents.archivedAt),
        ),
      )
      .returning();

    if (!result.length) {
      throw new NotFoundException("Document not found");
    }
  }

  /**
   * Workspace access via organisation membership
   */
  private async assertWorkspaceAccess(
    workspaceId: string,
    organisationId: string,
    organisationMemberId: string,
  ) {
    const [member] = await this.db
      .select()
      .from(schema.workspaceMembers)
      .innerJoin(
        schema.workspaces,
        eq(schema.workspaceMembers.workspaceId, schema.workspaces.id),
      )
      .where(
        and(
          eq(schema.workspaceMembers.workspaceId, workspaceId),
          eq(
            schema.workspaceMembers.organisationMemberId,
            organisationMemberId,
          ),
          eq(schema.workspaces.organisationId, organisationId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new ForbiddenException("You do not have access to this workspace");
    }
  }
}
