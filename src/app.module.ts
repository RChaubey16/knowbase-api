import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DbModule } from "./db/db.module";
import { AuthModule } from "./auth/auth.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { DocumentsModule } from "./documents/documents.module";
import { OrganisationsModule } from "./organisations/organisations.module";
import { RagModule } from "./rag/rag.module";
import { BullModule } from "@nestjs/bullmq";
import { SupabaseModule } from "./supabase/supabase.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>("REDIS_HOST", "localhost"),
          port: config.get<number>("REDIS_PORT", 6379),
        },
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: 1000,
          removeOnFail: 3000,
          backoff: 2000,
        },
      }),
    }),
    DbModule,
    AuthModule,
    WorkspacesModule,
    DocumentsModule,
    OrganisationsModule,
    RagModule,
    SupabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
