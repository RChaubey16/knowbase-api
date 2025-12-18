import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { users } from "./users";
import { workspaceRoleEnum } from "./enums";

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    role: workspaceRoleEnum("role").notNull().default("member"),

    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  // Below code, ensures a user can belong to a workspace only once (no duplicate memberships)
  (table) => ({
    uniqueMember: uniqueIndex("workspace_user_unique").on(
      table.workspaceId,
      table.userId,
    ),
  }),
);
