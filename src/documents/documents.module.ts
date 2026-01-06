import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { RagModule } from "src/rag/rag.module";

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
  imports: [RagModule],
})
export class DocumentsModule {}
