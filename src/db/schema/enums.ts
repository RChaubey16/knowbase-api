import { pgEnum } from "drizzle-orm/pg-core";

export const organisationRoleEnum = pgEnum("organisation_role", [
  "owner",
  "admin",
  "member",
]);

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const documentTypeEnum = pgEnum("document_type", ["text", "url", "pdf"]);

export const documentStatusEnum = pgEnum("document_status", [
  "ready",
  "processing",
  "failed",
]);
