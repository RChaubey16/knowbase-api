import { Module } from "@nestjs/common";
import { RagService } from "./rag.service";
import { BullModule } from "@nestjs/bullmq";
import { RagController } from "./rag.controller";
import { IngestionProcessor } from "./ingestion/ingestion.processor";
import { ChunkingService } from "./chunking/chunking.service";
import { EmbeddingService } from "./embedding/embedding.service";
import { GroqService } from "./groq/groq.service";
import { SupabaseModule } from "src/supabase/supabase.module";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "rag-ingestion",
    }),
    SupabaseModule,
  ],
  controllers: [RagController],
  providers: [
    RagService,
    ChunkingService,
    EmbeddingService,
    GroqService,
    IngestionProcessor,
  ],
  exports: [RagService, GroqService],
})
export class RagModule {}
