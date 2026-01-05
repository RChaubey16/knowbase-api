import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { documentTypeEnum, documentStatusEnum } from "./enums";
import { organisationMembers } from "./organisation-members";

// DOCUMENT
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),

  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),

  createdByMemberId: uuid("created_by_member_id").references(
    () => organisationMembers.id,
    { onDelete: "set null" },
  ),

  title: text("title").notNull(),
  type: documentTypeEnum("type").notNull().default("text"),
  status: documentStatusEnum("status").notNull().default("ready"),
  source: text("source"), // "manual", "url", later useful

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

// DOCUMENT CONTENTS
export const documentContents = pgTable("document_contents", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => documents.id, { onDelete: "cascade" }),

  rawContent: text("raw_content").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
