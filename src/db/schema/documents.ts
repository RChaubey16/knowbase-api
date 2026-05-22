import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  integer,
  vector,
} from "drizzle-orm/pg-core";
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
  status: documentStatusEnum("status").notNull().default("processing"),
  source: text("source"),
  sourceUrl: text("source_url"),

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

// DOCUMENT CHUNKS
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    documentIdIdx: index("document_chunks_document_id_idx").on(
      table.documentId,
    ),
    documentChunkOrderIdx: index("document_chunk_order_idx").on(
      table.documentId,
      table.chunkIndex,
    ),
  }),
);

// DOCUMENT CHUNK EMBEDDINGS
export const documentChunkEmbeddings = pgTable(
  "document_chunk_embeddings",
  {
    chunkId: uuid("chunk_id")
      .primaryKey()
      .references(() => documentChunks.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 768 }),
    model: text("model").notNull().default("jina-embeddings-v2-base-en"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    embeddingIdx: index("embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);
