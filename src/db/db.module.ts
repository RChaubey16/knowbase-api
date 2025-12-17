import { Module, Global } from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

@Global()
@Module({
  providers: [
    {
      provide: "DB",
      useFactory: () => {
        const client = postgres(process.env.DATABASE_URL!, {
          ssl: "require",
        });

        return drizzle(client, { schema });
      },
    },
  ],
  exports: ["DB"],
})
export class DbModule {}
