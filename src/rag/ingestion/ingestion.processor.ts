import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { ChunkingService } from "../chunking/chunking.service";

@Processor("rag-ingestion", {
  concurrency: 3,
  limiter: { duration: 10000, max: 20 },
})
export class IngestionProcessor extends WorkerHost {
  constructor(private readonly chunkingService: ChunkingService) {
    super();
  }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case "ingest-manual-document":
        this.ingestManualDoc(job.data);
        break;

      case "ingest-web-scraping-document":
        console.log("Staring web scraping document task");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        break;

      default:
        console.log(`Unknown job name: ${job.name}`);
    }
  }

  private ingestManualDoc(data: {
    documentId: string;
    documentContents: string;
  }) {
    const { documentContents } = data;

    // 1. Chunk the document contents into smaller chunks.
    const chunks = this.chunkingService.chunk(documentContents);
    console.log(`CHUNKS`, chunks);

    // 2. Persist chunks, store in "document_chunks" table in supabase.

    // 3. Generate embeddings for each chunk and store in "document_embeddings" table in supabase.

    // 4. Make the document status as ready.
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
