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
import { Chunk } from "./rag.types";

@Injectable()
export class RagService {
  constructor(
    @Inject("DB") private db: PostgresJsDatabase<typeof schema>,
    @InjectQueue("rag-ingestion") private readonly ragQueue: Queue,
    private readonly supabase: SupabaseService,
    private readonly embeddingService: EmbeddingService,
    private readonly geminiService: GeminiService,
  ) {}

  async indexDocument(
    documentId: string,
    documentContents: string,
    force = false,
  ) {
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
      await this.db
        .delete(schema.documentChunks)
        .where(eq(schema.documentChunks.documentId, documentId));
    }

    await this.ragQueue.add(
      "ingest-manual-document",
      { documentId, documentContents },
      { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
    );

    return { status: true, message: "Document indexing job added to Queue" };
  }

  async answerQuery(input: {
    workspaceId: string;
    query: string;
    topK?: number;
  }) {
    const queryEmbedding = await this.embeddingService.embedQuery(input.query);
    const flatEmbedding = queryEmbedding[0];

    const { data, error } = (await this.supabase
      .getClient()
      .rpc("match_document_chunks", {
        query_embedding: flatEmbedding,
        match_workspace_id: input.workspaceId,
        match_count: input.topK ?? 3,
      })) as { data: Chunk[] | null; error: PostgrestError | null };

    if (error) throw error;

    return this.geminiService.generate(input.query, data || []);
  }
}
