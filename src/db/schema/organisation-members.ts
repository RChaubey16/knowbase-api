import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organisations } from "./organisations";
import { users } from "./users";
import { organisationRoleEnum } from "./enums";

export const organisationMembers = pgTable(
  "organisation_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    role: organisationRoleEnum("role").notNull().default("member"),

    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueOrgMember: uniqueIndex("org_user_unique").on(
      table.organisationId,
      table.userId,
    ),
  }),
);
