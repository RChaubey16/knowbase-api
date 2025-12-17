import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: text("email").notNull().unique(),

  firstName: text("first_name"),
  lastName: text("last_name"),
  avatar: text("avatar"),

  password: text("password"), // nullable for OAuth

  googleId: text("google_id"),

  provider: text("provider").notNull(), // 'local' | 'google'

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
