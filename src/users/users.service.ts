import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { users } from "../db/schema";

@Injectable()
export class UsersService {
  constructor(@Inject("DB") private db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Finds user by email
   *
   * @param email - User email
   * @returns - User object
   */
  async findByEmail(email: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0];
  }

  async findById(id: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Creates a new user
   *
   * @param data - User data
   * @returns - User object
   */
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

  /**
   * Updates user
   *
   * @param id - User ID
   * @param data - User data
   */
  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    await this.db.update(users).set(data).where(eq(users.id, id));
  }
}
