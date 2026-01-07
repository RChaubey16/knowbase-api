import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

@Injectable()
export class RagService {
  constructor(@InjectQueue("rag-ingestion") private readonly ragQueue: Queue) {}

  async indexDocument(documentId: string, documentContents: string) {
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

    return true;
  }
}
