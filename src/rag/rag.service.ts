import { Injectable, Inject } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { PostgrestError } from "@supabase/supabase-js";

import * as schema from "../db/schema";
import { SupabaseService } from "src/supabase/supabase.service";
import { GeminiService } from "./gemini/gemini.service";
import { EmbeddingService } from "./embedding/embedding.service";
import { Chunk } from "./gemini/gemini.service";

@Injectable()
export class RagService {
  constructor(
    @Inject("DB") private db: PostgresJsDatabase<typeof schema>,
    @InjectQueue("rag-ingestion") private readonly ragQueue: Queue,
    private readonly supabase: SupabaseService,
    private readonly embeddingService: EmbeddingService,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Indexes a document
   * @param documentId The ID of the document
   * @param documentContents The contents of the document
   * @returns The result of the indexing operation
   */
  async indexDocument(documentId: string, documentContents: string) {
    // Check if chunks already exist for this document
    const existingChunks = await this.db
      .select({ id: schema.documentChunks.id })
      .from(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, documentId))
      .limit(1);

    if (existingChunks.length > 0) {
      console.log(`Document ${documentId} is already indexed. Skipping.`);
      return {
        status: true,
        message: "Document is already indexed",
      };
    }

    // Proceed with adding job to queue
    await this.ragQueue.add(
      "ingest-manual-document",
      {
        documentId,
        documentContents,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );

    console.log(`Indexing job added for document ${documentId}`);

    return {
      status: true,
      message: "Document indexing job added to Queue",
    };
  }

  /**
   * Answers a query
   * @param input The input to the query
   * @returns The result of the query
   */
  async answerQuery(input: {
    workspaceId: string;
    query: string;
    topK?: number;
  }) {
    // 1. Embed query
    const queryEmbedding = await this.embeddingService.embedQuery(input.query);
    const flatEmbedding = queryEmbedding[0];

    // 2. Retrieve relevant chunks
    const { data, error } = (await this.supabase
      .getClient()
      .rpc("match_document_chunks", {
        query_embedding: flatEmbedding,
        match_workspace_id: input.workspaceId,
        match_count: input.topK ?? 3,
      })) as { data: Chunk[] | null; error: PostgrestError | null };

    if (error) throw error;

    const answer = await this.geminiService.generate(input.query, data || []);
    return answer;
  }
}
