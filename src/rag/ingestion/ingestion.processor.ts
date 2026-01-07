import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { ChunkingService } from "../chunking/chunking.service";
import { EmbeddingService } from "../embedding/embedding.service";
import { Inject } from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";

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

      case "ingest-web-scraping-document":
        console.log("Staring web scraping document task");
        await new Promise((resolve) => setTimeout(resolve, 3000));

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
      console.log(`CHUNKS (${chunks.length} total):`, chunks);

      // 2. Insert chunks into database and get their IDs
      const chunkRecords = await this.db
        .insert(schema.documentChunks)
        .values(
          chunks.map((content, index) => ({
            documentId,
            chunkIndex: index,
            content,
            tokenCount: content.split(/\s+/).length, // rough word count
          })),
        )
        .returning();

      console.log(`Inserted ${chunkRecords.length} chunks into database`);

      // 3. Generate embeddings for all chunks
      const embeddings = await this.embeddingService.embedAndStore(chunks);
      console.log(`Generated ${embeddings.length} embeddings`);

      // 4. Insert embeddings into database
      await this.db.insert(schema.documentChunkEmbeddings).values(
        chunkRecords.map((chunk, index) => ({
          chunkId: chunk.id,
          embedding: embeddings[index],
          model: "jina-embeddings-v2-base-en",
        })),
      );

      console.log(`Inserted ${embeddings.length} embeddings into database`);

      // 5. Update document status to ready
      await this.db
        .update(schema.documents)
        .set({ status: "ready" })
        .where(eq(schema.documents.id, documentId));

      console.log(`Document ${documentId} is now ready`);
    } catch (error) {
      console.error("Error in ingestManualDoc:", error);

      // Update document status to failed
      await this.db
        .update(schema.documents)
        .set({ status: "failed" })
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
