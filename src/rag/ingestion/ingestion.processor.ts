import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";

@Processor("rag-ingestion", {
  concurrency: 3,
  limiter: { duration: 10000, max: 20 },
})
export class IngestionProcessor extends WorkerHost {
  async process(job: Job): Promise<any> {
    switch (job.name) {
      case "ingest-manual-document":
        console.log("Staring manual document task");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        break;

      case "ingest-web-scraping-document":
        console.log("Staring web scraping document task");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        break;

      default:
        console.log(`Unknown job name: ${job.name}`);
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
