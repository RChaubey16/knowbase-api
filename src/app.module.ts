import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DbModule } from "./db/db.module";
import { AuthModule } from "./auth/auth.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { DocumentsModule } from "./documents/documents.module";
import { OrganisationsModule } from "./organisations/organisations.module";
import { RagModule } from "./rag/rag.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // makes ConfigService available everywhere
      envFilePath: ".env",
    }),
    DbModule,
    AuthModule,
    WorkspacesModule,
    DocumentsModule,
    OrganisationsModule,
    RagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
