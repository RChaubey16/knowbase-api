import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import * as cheerio from "cheerio";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, isNull, desc, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { RagService } from "src/rag/rag.service";

@Injectable()
export class DocumentsService {
  constructor(
    @Inject("DB")
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly ragService: RagService,
  ) { }

  /**
   * Creates a new document in a workspace
   * @param workspaceId The ID of the workspace
   * @param organisationId The ID of the organisation
   * @param organisationMemberId The ID of the organisation member
   * @param dto The document creation data transfer object
   * @returns The created document
   */
  async createDocument(
    workspaceIdentifier: string,
    organisationId: string,
    organisationMemberId: string,
    dto: CreateDocumentDto,
  ) {
    const workspaceId = await this.assertWorkspaceAccess(
      workspaceIdentifier,
      organisationId,
      organisationMemberId,
    );

    let rawContent: string;
    let sourceUrl: string | undefined;

    if (dto.type === "url" && dto.url) {
      rawContent = await this.fetchUrlContent(dto.url);
      sourceUrl = dto.url;
    } else if (dto.content?.trim()) {
      rawContent = dto.content;
    } else {
      throw new BadRequestException(
        "Either content or a valid URL is required.",
      );
    }

    const isIndexed = dto.isIndexed ?? false;
    const docStatus = isIndexed ? "processing" : "ready";

    const [document] = await this.db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(schema.documents)
        .values({
          workspaceId,
          createdByMemberId: organisationMemberId,
          title: dto.title.trim(),
          type: dto.type ?? "text",
          status: docStatus,
          source: dto.source ?? "manual",
          sourceUrl: sourceUrl ?? null,
        })
        .returning();

      await tx.insert(schema.documentContents).values({
        documentId: doc.id,
        rawContent,
      });

      return [doc];
    });

    if (isIndexed) {
      await this.ragService.indexDocument(document.id, rawContent);
    }

    return document;
  }

  /**
   * Lists all documents in a workspace
   * @param workspaceId The ID of the workspace
   * @param organisationId The ID of the organisation
   * @param organisationMemberId The ID of the organisation member
   * @param limit The maximum number of documents to return
   * @returns An array of documents
   */
  async listDocuments(
    workspaceIdentifier: string,
    organisationId: string,
    organisationMemberId: string,
    limit: number,
  ) {
    const workspaceId = await this.assertWorkspaceAccess(
      workspaceIdentifier,
      organisationId,
      organisationMemberId,
    );

    const safeLimit = Math.min(limit, 50);

    return await this.db
      .select({
        id: schema.documents.id,
        title: schema.documents.title,
        content: schema.documentContents.rawContent,
        type: schema.documents.type,
        source: schema.documents.source,
        sourceUrl: schema.documents.sourceUrl,
        status: schema.documents.status,
        snippet: sql<string>`left(${schema.documentContents.rawContent}, 120)`,
        isIndexed: sql<boolean>`exists(select 1 from ${schema.documentChunks} where ${schema.documentChunks.documentId} = ${schema.documents.id})`,
        createdAt: schema.documents.createdAt,
        updatedAt: schema.documents.updatedAt,
      })
      .from(schema.documents)
      .innerJoin(
        schema.documentContents,
        eq(schema.documents.id, schema.documentContents.documentId),
      )
      .where(
        and(
          eq(schema.documents.workspaceId, workspaceId),
          isNull(schema.documents.archivedAt),
        ),
      )
      .orderBy(desc(schema.documents.updatedAt))
      .limit(safeLimit);
  }

  /**
   * Gets a document by ID
   * @param workspaceId The ID of the workspace
   * @param documentId The ID of the document
   * @param organisationId The ID of the organisation
   * @param organisationMemberId The ID of the organisation member
   * @returns The document
   */
  async getDocumentById(
    workspaceIdentifier: string,
    documentId: string,
    organisationId: string,
    organisationMemberId: string,
  ) {
    const workspaceId = await this.assertWorkspaceAccess(
      workspaceIdentifier,
      organisationId,
      organisationMemberId,
    );

    const result = await this.db
      .select({
        id: schema.documents.id,
        title: schema.documents.title,
        type: schema.documents.type,
        source: schema.documents.source,
        sourceUrl: schema.documents.sourceUrl,
        status: schema.documents.status,
        isIndexed: sql<boolean>`exists(select 1 from ${schema.documentChunks} where ${schema.documentChunks.documentId} = ${schema.documents.id})`,
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

  /**
   * Updates a document
   * @param workspaceId The ID of the workspace
   * @param documentId The ID of the document
   * @param organisationId The ID of the organisation
   * @param organisationMemberId The ID of the organisation member
   * @param dto The document update data transfer object
   * @returns The updated document
   */
  async updateDocument(
    workspaceIdentifier: string,
    documentId: string,
    organisationId: string,
    organisationMemberId: string,
    dto: UpdateDocumentDto,
  ) {
    const workspaceId = await this.assertWorkspaceAccess(
      workspaceIdentifier,
      organisationId,
      organisationMemberId,
    );
    const isIndexed = dto.isIndexed ?? false;
    const docStatus = isIndexed ? "processing" : "ready";

    const updated = await this.db.transaction(async (tx) => {
      const [doc] = await tx
        .update(schema.documents)
        .set({
          title: dto.title.trim(),
          status: docStatus,
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

    if (isIndexed) {
      await this.ragService.indexDocument(updated.id, dto.content, true);
    }

    return updated;
  }

  /**
   * Archives a document
   * @param workspaceId The ID of the workspace
   * @param documentId The ID of the document
   * @param organisationId The ID of the organisation
   * @param organisationMemberId The ID of the organisation member
   */
  async archiveDocument(
    workspaceIdentifier: string,
    documentId: string,
    organisationId: string,
    organisationMemberId: string,
  ) {
    const workspaceId = await this.assertWorkspaceAccess(
      workspaceIdentifier,
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

  async search(
    query: string,
    mode: string,
    workspaceIdentifier: string,
    organisationId: string,
    organisationMemberId: string,
    limit: number = 20,
  ) {
    const workspaceId = await this.assertWorkspaceAccess(
      workspaceIdentifier,
      organisationId,
      organisationMemberId,
    );

    const safeLimit = Math.min(limit, 50);

    if (mode === "simple") {
      return this.db.execute(sql`
     SELECT
        d.id,
        d.title,
        d.type,
        d.status,
        dc.raw_content AS snippet,
        ts_rank(
          d.search_vector || dc.search_vector,
          plainto_tsquery('english', ${query})
        ) AS rank
      FROM documents d
      JOIN document_contents dc ON dc.document_id = d.id
      WHERE
        d.workspace_id = ${workspaceId}
        AND d.archived_at IS NULL
        AND (d.search_vector || dc.search_vector)
            @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${safeLimit};
    `);
    }

    // RAG mode
    const payload = {
      workspaceId,
      query,
      topK: 3,
    };
    const answer = await this.ragService.answerQuery(payload);

    return [
      {
        snippet: answer,
      },
    ];
  }

  async reindexDocument(
    workspaceIdentifier: string,
    documentId: string,
    organisationId: string,
    organisationMemberId: string,
  ) {
    const workspaceId = await this.assertWorkspaceAccess(
      workspaceIdentifier,
      organisationId,
      organisationMemberId,
    );

    const [doc] = await this.db
      .select({
        id: schema.documents.id,
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

    if (!doc) {
      throw new NotFoundException("Document not found");
    }

    await this.db
      .update(schema.documents)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(schema.documents.id, documentId));

    await this.ragService.indexDocument(doc.id, doc.content, true);
  }

  private async fetchUrlContent(url: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": "Knowbase/1.0 (document indexer)" },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadRequestException(`Could not reach "${url}". Check the URL and try again.`);
    }

    if (!response.ok) {
      throw new BadRequestException(
        `Failed to fetch "${url}": ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $("script, style, nav, header, footer, noscript, iframe").remove();

    const text = $("body")
      .text()
      .replace(/[\t ]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text) {
      throw new BadRequestException(
        "No readable content found at the provided URL.",
      );
    }

    return text;
  }

  /**
   * Workspace access via organisation membership
   */
  private async assertWorkspaceAccess(
    workspaceIdentifier: string,
    organisationId: string,
    organisationMemberId: string,
  ): Promise<string> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        workspaceIdentifier,
      );

    const [member] = await this.db
      .select({
        id: schema.workspaces.id,
      })
      .from(schema.workspaceMembers)
      .innerJoin(
        schema.workspaces,
        eq(schema.workspaceMembers.workspaceId, schema.workspaces.id),
      )
      .where(
        and(
          isUuid
            ? eq(schema.workspaces.id, workspaceIdentifier)
            : eq(schema.workspaces.slug, workspaceIdentifier),
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

    return member.id;
  }
}
