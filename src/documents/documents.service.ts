import { Injectable, ForbiddenException } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { CreateDocumentDto } from "./dto/create-document.dto";

@Injectable()
export class DocumentsService {
  constructor(
    @Inject("DB")
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

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
