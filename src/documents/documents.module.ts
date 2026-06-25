import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { DemoReadOnlyGuard } from "../auth/guards/demo-readonly.guard";
import { RagModule } from "src/rag/rag.module";

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DemoReadOnlyGuard],
  imports: [RagModule],
})
export class DocumentsModule {}
