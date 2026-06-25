import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../db/schema/";
import { users } from "../db/schema/users";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject("DB") private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Find a user by their email address
   *
   * @param email - Email address to search for
   * @returns User record, or undefined if no account exists with that email
   */
  async findByEmail(email: string) {
    // Limit to 1 because email is unique; avoids a full table scan
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0];
  }

  /**
   * Find a user by their primary key
   *
   * @param id - UUID of the user
   * @returns User record, or undefined if not found
   */
  async findById(id: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Persist a new user account
   *
   * @param data - Fields required to create the user (email, provider, optional profile fields)
   * @returns Newly created user record
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
    // Insert and return the full row so callers don't need a follow-up query
    const result = await this.db.insert(users).values(data).returning();

    return result[0];
  }

  /**
   * Apply a partial update to an existing user record
   *
   * @param id - UUID of the user to update
   * @param data - Partial fields to overwrite (e.g. refreshTokenHash, avatar)
   */
  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    // No returning() needed — callers don't use the updated record
    await this.db.update(users).set(data).where(eq(users.id, id));
  }
}
