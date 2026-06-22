import { Inject } from "@nestjs/common";
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
  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
    @Inject("DB") private db: PostgresJsDatabase<typeof schema>,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case "ingest-manual-document":
        await this.ingestManualDoc(job.data);
        break;

      default:
        console.log(`Unknown job name: ${job.name}`);
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
          model: "sentence-transformers/all-mpnet-base-v2",
        })),
      );

      // 5. Update document status to ready
      await this.db
        .update(schema.documents)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(schema.documents.id, documentId));

      console.log(`Document ${documentId} is now ready`);

      return {
        status: true,
        message: "Document is now ready",
      };
    } catch (error) {
      console.error("Error in ingestManualDoc:", error);

      // Update document status to failed
      await this.db
        .update(schema.documents)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(schema.documents.id, data.documentId));

      throw error; // Re-throw so BullMQ marks job as failed
    }
  }

  @OnWorkerEvent("active")
  onAdded(job: Job) {
    console.log(`JOB ADDED`, job.id);
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job) {
    console.log(`JOB COMPLETED`, job.id);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job) {
    console.log(`JOB FAILED`, job.id);
    console.log(`Attempt Number: ${job.attemptsMade}`);
  }
}
