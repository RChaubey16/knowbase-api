import { Injectable, Inject, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { PostgrestError } from "@supabase/supabase-js";

import * as schema from "../db/schema";
import { SupabaseService } from "src/supabase/supabase.service";
import { GeminiService } from "./gemini/gemini.service";
import { EmbeddingService } from "./embedding/embedding.service";
import { Chunk } from "./rag.types";

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    @Inject("DB") private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectQueue("rag-ingestion") private readonly ragQueue: Queue,
    private readonly supabase: SupabaseService,
    private readonly embeddingService: EmbeddingService,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Enqueue a document for chunking and embedding via the BullMQ ingestion worker
   *
   * @param documentId - UUID of the document to index
   * @param documentContents - Plain-text content to chunk and embed
   * @param force - When true, existing chunks are deleted before re-indexing
   * @returns Status object indicating whether the job was queued or skipped
   */
  async indexDocument(
    documentId: string,
    documentContents: string,
    force = false,
  ) {
    // Check whether the document already has chunks to avoid duplicate indexing
    const existingChunks = await this.db
      .select({ id: schema.documentChunks.id })
      .from(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, documentId))
      .limit(1);

    if (existingChunks.length > 0) {
      if (!force) {
        return { status: true, message: "Document is already indexed" };
      }
      // Delete stale chunks; cascade removes their embeddings
      this.logger.log(`Force re-index: clearing ${existingChunks.length} stale chunk(s) for document ${documentId}`);
      await this.db
        .delete(schema.documentChunks)
        .where(eq(schema.documentChunks.documentId, documentId));
    }

    // Add to the queue with exponential backoff — the worker handles chunking and embedding
    await this.ragQueue.add(
      "ingest-manual-document",
      { documentId, documentContents },
      { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
    );

    return { status: true, message: "Document indexing job added to Queue" };
  }

  /**
   * Retrieve the most relevant document chunks for a query and generate a grounded answer
   *
   * @param input - Object containing workspaceId, query text, and optional topK limit
   * @returns Generated answer string grounded in the retrieved chunks
   * @throws PostgrestError if the Supabase vector search RPC fails
   */
  async answerQuery(input: {
    workspaceId: string;
    query: string;
    topK?: number;
  }) {
    // Embed the query so it can be compared against stored chunk embeddings
    const queryEmbedding = await this.embeddingService.embedQuery(input.query);
    const flatEmbedding = queryEmbedding[0];

    // Run cosine similarity search via the Supabase pgvector RPC
    const { data, error } = (await this.supabase
      .getClient()
      .rpc("match_document_chunks", {
        query_embedding: flatEmbedding,
        match_workspace_id: input.workspaceId,
        match_count: input.topK ?? 3,
      })) as { data: Chunk[] | null; error: PostgrestError | null };

    if (error) throw error;

    this.logger.log(`RAG query in workspace ${input.workspaceId}: retrieved ${(data || []).length} chunk(s)`);
    // Pass the retrieved chunks to Gemini to produce a grounded answer
    return this.geminiService.generate(input.query, data || []);
  }
}
