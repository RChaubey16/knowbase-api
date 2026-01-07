import { Module } from "@nestjs/common";
import { RagService } from "./rag.service";
import { BullModule } from "@nestjs/bullmq";
import { RagController } from "./rag.controller";
import { IngestionProcessor } from "./ingestion/ingestion.processor";
import { ChunkingService } from "./chunking/chunking.service";
import { EmbeddingService } from "./embedding/embedding.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "rag-ingestion",
    }),
  ],
  controllers: [RagController],
  providers: [
    RagService,
    ChunkingService,
    EmbeddingService,
    IngestionProcessor,
  ],
  exports: [RagService],
})
export class RagModule {}
