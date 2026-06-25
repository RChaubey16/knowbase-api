import { Inject, Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { ChunkingService } from "../chunking/chunking.service";
import { EmbeddingService } from "../embedding/embedding.service";

import * as schema from "../../db/schema";

@Processor("rag-ingestion", {
  concurrency: 3,
  limiter: { duration: 10000, max: 20 },
})
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
    @Inject("DB") private readonly db: PostgresJsDatabase<typeof schema>,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case "ingest-manual-document":
        await this.ingestManualDoc(job.data);
        break;

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async ingestManualDoc(data: {
    documentId: string;
    documentContents: string;
  }) {
    try {
      const { documentId, documentContents } = data;

      // 1. Chunk the document contents
      const chunks = this.chunkingService.chunk(documentContents);

      // 2. Insert chunks into database and get their IDs
      const chunkRecords = await this.db
        .insert(schema.documentChunks)
        .values(
          chunks.map((content, index) => ({
            documentId,
            chunkIndex: index,
            content,
            tokenCount: content.split(/\s+/).length,
          })),
        )
        .returning();

      // Sort by chunkIndex to guarantee the order matches the chunks array
      const orderedRecords = [...chunkRecords].sort(
        (a, b) => a.chunkIndex - b.chunkIndex,
      );

      // 3. Generate embeddings for all chunks (same order as chunks array)
      const embeddings = await this.embeddingService.embedAndStore(chunks);

      // 4. Insert embeddings into database
      await this.db.insert(schema.documentChunkEmbeddings).values(
        orderedRecords.map((chunk, index) => ({
          chunkId: chunk.id,
          embedding: embeddings[index],
          model: "jina-embeddings-v2-base-en",
        })),
      );

      // 5. Update document status to ready
      await this.db
        .update(schema.documents)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(schema.documents.id, documentId));

      this.logger.log(`Document ${documentId} indexed successfully`);

      return {
        status: true,
        message: "Document is now ready",
      };
    } catch (error) {
      this.logger.error("Failed to ingest document", error instanceof Error ? error.stack : String(error));

      // Remove any partially inserted chunks so the document isn't left in a
      // half-indexed state (chunks without matching embeddings would make
      // isIndexed appear true while RAG results would be incomplete)
      await this.db
        .delete(schema.documentChunks)
        .where(eq(schema.documentChunks.documentId, data.documentId))
        .catch((cleanupErr) =>
          this.logger.error(
            `Failed to clean up partial chunks for document ${data.documentId}`,
            cleanupErr instanceof Error ? cleanupErr.stack : String(cleanupErr),
          ),
        );

      await this.db
        .update(schema.documents)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(schema.documents.id, data.documentId));

      throw error; // Re-throw so BullMQ marks job as failed
    }
  }

  @OnWorkerEvent("active")
  onAdded(job: Job) {
    this.logger.debug(`Job active: ${job.id}`);
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job) {
    this.logger.log(`Job completed: ${job.id}`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job) {
    this.logger.error(`Job failed: ${job.id} (attempt ${job.attemptsMade})`);
  }
}
