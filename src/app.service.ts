import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./db/schema";

@Injectable()
export class AppService {
  constructor(
    @Inject("DB") private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getHealth() {
    let dbStatus: "ok" | "error" = "ok";
    try {
      await this.db.execute(sql`SELECT 1`);
    } catch {
      dbStatus = "error";
    }

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: dbStatus,
    };
  }
}
