import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Inject } from "@nestjs/common";
import { Queue } from "bullmq";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { SupabaseService } from "src/supabase/supabase.service";
import { GeminiService } from "./gemini/gemini.service";
import { EmbeddingService } from "./embedding/embedding.service";

@Injectable()
export class RagService {
  constructor(
    @Inject("DB") private db: PostgresJsDatabase<typeof schema>,
    @InjectQueue("rag-ingestion") private readonly ragQueue: Queue,
    private readonly supabase: SupabaseService,
    private readonly embeddingService: EmbeddingService,
    private readonly geminiService: GeminiService,
  ) {}

  async indexDocument(documentId: string, documentContents: string) {
    // Check if chunks already exist for this document
    const existingChunks = await this.db
      .select({ id: schema.documentChunks.id })
      .from(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, documentId))
      .limit(1);

    if (existingChunks.length > 0) {
      console.log(`Document ${documentId} is already indexed. Skipping.`);
      return false;
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

    return true;
  }

  async answerQuery(input: {
    workspaceId: string;
    query: string;
    topK?: number;
  }) {
    // 1. Embed query
    const queryEmbedding = await this.embeddingService.embedQuery(input.query);
    const flatEmbedding = queryEmbedding[0];

    // 2. Retrieve relevant chunks
    const { data, error } = await this.supabase
      .getClient()
      .rpc("match_document_chunks", {
        query_embedding: flatEmbedding,
        match_workspace_id: input.workspaceId,
        match_count: input.topK ?? 3,
      });

    if (error) throw error;

    const answer = await this.geminiService.generate(input.query, data);
    return answer;
  }
}
