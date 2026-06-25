import {
  Injectable,
  ForbiddenException,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import * as cheerio from "cheerio";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> };
};
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, isNull, desc, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { RagService } from "src/rag/rag.service";

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @Inject("DB")
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly ragService: RagService,
  ) {}

  /**
   * Create a new document in a workspace
   *
   * @param workspaceIdentifier - Workspace UUID or slug
   * @param organisationId - ID of the organisation context
   * @param organisationMemberId - Membership ID of the creator
   * @param dto - Document creation payload (title, type, content or URL, isIndexed flag)
   * @returns Newly created document record
   * @throws ForbiddenException if the caller does not have workspace access
   * @throws BadRequestException if neither content nor a valid URL is provided
   */
  async createDocument(
    workspaceIdentifier: string,
    organisationId: string,
    organisationMemberId: string,
    dto: CreateDocumentDto,
  ) {
    // Verify access and resolve the workspace UUID before any writes
    const workspaceId = await this.assertWorkspaceAccess(
      workspaceIdentifier,
      organisationId,
      organisationMemberId,
    );

    let rawContent: string;
    let sourceUrl: string | undefined;

    if (dto.type === "url" && dto.url) {
      // Fetch and extract readable text from the remote URL
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
    // Set status to "processing" immediately so the UI can show indexing progress
    const docStatus = isIndexed ? "processing" : "ready";

    // Insert the document and its content atomically to keep them in sync
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
      // Enqueue the indexing job after the transaction commits so the worker can read the content
      await this.ragService.indexDocument(document.id, rawContent);
    }

    return document;
  }

  /**
   * Parse a PDF upload and create a document from its extracted text
   *
   * @param workspaceIdentifier - Workspace UUID or slug
   * @param organisationId - ID of the organisation context
   * @param organisationMemberId - Membership ID of the uploader
   * @param file - Uploaded PDF file buffer from Multer
   * @param title - Display title for the new document
   * @param isIndexed - Whether to enqueue the document for RAG indexing
   * @returns Newly created document record
   * @throws ForbiddenException if the caller does not have workspace access
   * @throws BadRequestException if the PDF cannot be parsed or contains no extractable text
   */
  async uploadPdf(
    workspaceIdentifier: string,
    organisationId: string,
    organisationMemberId: string,
    file: Express.Multer.File,
    title: string,
    isIndexed: boolean,
  ) {
    const workspaceId = await this.assertWorkspaceAccess(
      workspaceIdentifier,
      organisationId,
      organisationMemberId,
    );

    let rawContent: string;
    try {
      // Extract plain text from the PDF binary — throws if the file is corrupt
      const parser = new PDFParse({ data: file.buffer });
      const result = await parser.getText();
      rawContent = result.text?.trim();
    } catch {
      throw new BadRequestException("Failed to parse PDF");
    }

    if (!rawContent) {
      throw new BadRequestException("PDF has no extractable text");
    }

    const docStatus = isIndexed ? "processing" : "ready";

    // Insert the document and its extracted content atomically
    const [document] = await this.db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(schema.documents)
        .values({
          workspaceId,
          createdByMemberId: organisationMemberId,
          title: title.trim(),
          type: "pdf",
          status: docStatus,
          source: "pdf",
        })
        .returning();

      await tx.insert(schema.documentContents).values({
        documentId: doc.id,
        rawContent,
      });

      return [doc];
    });

    if (isIndexed) {
      // Enqueue indexing after the transaction so the worker sees the committed content
      await this.ragService.indexDocument(document.id, rawContent);
    }

    return document;
  }

  /**
   * List non-archived documents in a workspace, ordered by most recently updated
   *
   * @param workspaceIdentifier - Workspace UUID or slug
   * @param organisationId - ID of the organisation context
   * @param organisationMemberId - Membership ID of the requester
   * @param limit - Maximum number of documents to return (capped at 50)
   * @returns Array of document records with snippet and isIndexed flag
   * @throws ForbiddenException if the caller does not have workspace access
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

    // Hard cap prevents unbounded result sets regardless of what the client sends
    const safeLimit = Math.min(limit, 50);

    return await this.db
      .select({
        id: schema.documents.id,
        title: schema.documents.title,
        type: schema.documents.type,
        source: schema.documents.source,
        sourceUrl: schema.documents.sourceUrl,
        status: schema.documents.status,
        snippet: sql<string>`left(${schema.documentContents.rawContent}, 120)`,
        // EXISTS subquery is cheaper than a COUNT and avoids a separate round-trip
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
          // Soft-delete filter: archivedAt IS NULL means the document is active
          isNull(schema.documents.archivedAt),
        ),
      )
      .orderBy(desc(schema.documents.updatedAt))
      .limit(safeLimit);
  }

  /**
   * Fetch a single document by its ID, including full content and indexing status
   *
   * @param workspaceIdentifier - Workspace UUID or slug
   * @param documentId - UUID of the document to retrieve
   * @param organisationId - ID of the organisation context
   * @param organisationMemberId - Membership ID of the requester
   * @returns Document record with full content and isIndexed flag
   * @throws ForbiddenException if the caller does not have workspace access
   * @throws NotFoundException if the document does not exist or is archived
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
   * Update the title and content of an existing document
   *
   * @param workspaceIdentifier - Workspace UUID or slug
   * @param documentId - UUID of the document to update
   * @param organisationId - ID of the organisation context
   * @param organisationMemberId - Membership ID of the requester
   * @param dto - Update payload containing new title, content, and isIndexed flag
   * @returns Updated document record
   * @throws ForbiddenException if the caller does not have workspace access
   * @throws NotFoundException if the document does not exist or is archived
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

    // Update both the document row and its content row in one transaction
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

      // Update the content separately since it lives in a 1:1 child table
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
      // Re-index with force=true so stale chunks from the previous content are replaced
      await this.ragService.indexDocument(updated.id, dto.content, true);
    }

    return updated;
  }

  /**
   * Soft-delete a document by setting its archivedAt timestamp
   *
   * @param workspaceIdentifier - Workspace UUID or slug
   * @param documentId - UUID of the document to archive
   * @param organisationId - ID of the organisation context
   * @param organisationMemberId - Membership ID of the requester
   * @throws ForbiddenException if the caller does not have workspace access
   * @throws NotFoundException if the document does not exist or is already archived
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

    // Set archivedAt to mark as deleted; isNull check prevents double-archiving
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
   * Search documents in a workspace using full-text search or RAG mode
   *
   * @param query - Search query string
   * @param mode - "simple" for tsvector full-text search, any other value triggers RAG
   * @param workspaceIdentifier - Workspace UUID or slug
   * @param organisationId - ID of the organisation context
   * @param organisationMemberId - Membership ID of the requester
   * @param limit - Maximum number of results (capped at 50, default: 20)
   * @returns Array of matching document snippets with relevance metadata
   * @throws ForbiddenException if the caller does not have workspace access
   */
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
      // Raw SQL is used here because tsvector operators are not expressible in the Drizzle query builder
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

    // RAG mode: embed the query, retrieve similar chunks, and generate a grounded answer
    const payload = {
      workspaceId,
      query,
      topK: 3,
    };
    const answer = await this.ragService.answerQuery(payload);

    // Wrap the answer in an array so the response shape is consistent with simple search
    return [
      {
        snippet: answer,
      },
    ];
  }

  /**
   * Delete existing chunks for a document and re-enqueue it for embedding
   *
   * @param workspaceIdentifier - Workspace UUID or slug
   * @param documentId - UUID of the document to re-index
   * @param organisationId - ID of the organisation context
   * @param organisationMemberId - Membership ID of the requester
   * @throws ForbiddenException if the caller does not have workspace access
   * @throws NotFoundException if the document does not exist or is archived
   */
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

    // Load the document content needed for re-indexing
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

    // Immediately mark as processing so the UI reflects the pending state
    await this.db
      .update(schema.documents)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(schema.documents.id, documentId));

    this.logger.log(`Reindex triggered for document ${documentId} in workspace ${workspaceId}`);
    // force=true clears stale chunks before re-ingesting
    await this.ragService.indexDocument(doc.id, doc.content, true);
  }

  /**
   * Fetch a URL and return its main readable text content, with markup stripped
   *
   * @param url - Remote URL to fetch
   * @returns Extracted plain text from the page body
   * @throws BadRequestException if the URL is unreachable, returns an error status, or has no readable text
   */
  private async fetchUrlContent(url: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": "Knowbase/1.0 (document indexer)" },
        // Abort after 15 s to prevent slow external pages from blocking the request
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

    // Remove non-content elements before extracting text
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
   * Resolve a workspace identifier (UUID or slug) and assert the caller is a member
   *
   * @param workspaceIdentifier - Workspace UUID or slug
   * @param organisationId - ID of the organisation the workspace must belong to
   * @param organisationMemberId - Membership ID used to verify access
   * @returns Resolved workspace UUID
   * @throws ForbiddenException if the caller is not a member of the workspace
   */
  private async assertWorkspaceAccess(
    workspaceIdentifier: string,
    organisationId: string,
    organisationMemberId: string,
  ): Promise<string> {
    // Determine whether the identifier is a UUID or a human-readable slug
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
