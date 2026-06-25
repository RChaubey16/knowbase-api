import { Module } from "@nestjs/common";
import { RagService } from "./rag.service";
import { BullModule } from "@nestjs/bullmq";
import { RagController } from "./rag.controller";
import { IngestionProcessor } from "./ingestion/ingestion.processor";
import { ChunkingService } from "./chunking/chunking.service";
import { EmbeddingService } from "./embedding/embedding.service";
import { GeminiService } from "./gemini/gemini.service";
import { SupabaseModule } from "src/supabase/supabase.module";
import { DemoReadOnlyGuard } from "../auth/guards/demo-readonly.guard";

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
    GeminiService,
    IngestionProcessor,
    DemoReadOnlyGuard,
  ],
  exports: [RagService, GeminiService],
})
export class RagModule {}
