import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

@Global()
@Module({
  providers: [
    {
      provide: "DB",
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>("DATABASE_URL");

        if (!databaseUrl) {
          throw new Error("DATABASE_URL is not defined");
        }

        const client = postgres(databaseUrl, {
          ssl: "require",
        });

        return drizzle(client, { schema });
      },
    },
  ],
  exports: ["DB"],
})
export class DbModule {}
