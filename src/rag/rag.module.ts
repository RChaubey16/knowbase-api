import { Module } from "@nestjs/common";
import { RagService } from "./rag.service";
import { BullModule } from "@nestjs/bullmq";
import { RagController } from "./rag.controller";
import { IngestionProcessor } from "./ingestion/ingestion.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "rag-ingestion",
    }),
  ],
  controllers: [RagController],
  providers: [RagService, IngestionProcessor],
  exports: [RagService],
})
export class RagModule {}
