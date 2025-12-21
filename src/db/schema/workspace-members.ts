import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { organisationMembers } from "./organisation-members";
import { workspaceRoleEnum } from "./enums";

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    organisationMemberId: uuid("organisation_member_id")
      .notNull()
      .references(() => organisationMembers.id, { onDelete: "cascade" }),

    role: workspaceRoleEnum("role").notNull().default("viewer"),

    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueWorkspaceMember: uniqueIndex("workspace_org_member_unique").on(
      table.workspaceId,
      table.organisationMemberId,
    ),
  }),
);
