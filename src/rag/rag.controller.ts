import { Controller, Post } from "@nestjs/common";
import { RagService } from "./rag.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Controller("rag")
export class RagController {
  constructor(
    @InjectQueue("rag-ingestion") private readonly ragQueue: Queue,
    private readonly ragService: RagService,
  ) {}

  @Post("ingest")
  async ingestDocument() {
    // TODO: Move this Queue to a separate service (IngestionService)
    await this.ragQueue.add(
      "ingest-manual-document",
      {
        documentId: "123",
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
    await this.ragQueue.add(
      "ingest-web-scraping-document",
      {
        documentId: "999",
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );

    return {
      message: "Document indexing job added to Queue",
    };
  }
}
