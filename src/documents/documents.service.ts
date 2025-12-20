import { Injectable, ForbiddenException } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, isNull, desc } from "drizzle-orm";
import * as schema from "../db/schema";
import { CreateDocumentDto } from "./dto/create-document.dto";

@Injectable()
export class DocumentsService {
  constructor(
    @Inject("DB")
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Creates a document in a workspace
   * @param workspaceId Workspace ID
   * @param userId User ID
   * @param dto Document data
   * @returns Created document
   */
  async createDocument(
    workspaceId: string,
    userId: string,
    dto: CreateDocumentDto,
  ) {
    // 1. Permission check
    await this.assertWorkspaceAccess(workspaceId, userId);

    // 2. Transaction
    const [document] = await this.db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(schema.documents)
        .values({
          workspaceId,
          createdBy: userId,
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

  /**
   * Lists documents in a workspace
   * @param workspaceId Workspace ID
   * @param userId User ID
   * @param limit Limit of documents to return
   * @returns List of documents
   */
  async listDocuments(workspaceId: string, userId: string, limit: number) {
    // 1. Permission check
    await this.assertWorkspaceAccess(workspaceId, userId);

    // 2. Safe limit
    const safeLimit = Math.min(limit, 50);

    // 3. Fetch documents
    const documents = await this.db
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
      .limit(safeLimit);

    return {
      items: documents,
    };
  }

  /**
   * Asserts that the user has access to the workspace
   * @param workspaceId Workspace ID
   * @param userId User ID
   */
  private async assertWorkspaceAccess(workspaceId: string, userId: string) {
    const [member] = await this.db
      .select()
      .from(schema.workspaceMembers)
      .where(
        and(
          eq(schema.workspaceMembers.workspaceId, workspaceId),
          eq(schema.workspaceMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new ForbiddenException("You do not have access to this workspace");
    }
  }
}
