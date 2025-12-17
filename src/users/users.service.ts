import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { users } from "../db/schema";

@Injectable()
export class UsersService {
  constructor(@Inject("DB") private db: PostgresJsDatabase<typeof schema>) {}

  async findByEmail(email: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0];
  }

  async create(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    googleId?: string;
    password?: string;
    provider: "local" | "google";
  }) {
    const result = await this.db.insert(users).values(data).returning();

    return result[0];
  }
}
