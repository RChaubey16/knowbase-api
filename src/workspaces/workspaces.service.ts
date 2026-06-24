import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../db/schema";
import { workspaces } from "../db/schema/workspaces";
import { workspaceMembers } from "../db/schema/workspace-members";
import { organisationMembers } from "../db/schema/organisation-members";
import { users } from "../db/schema/users";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { AddWorkspaceMembersDto } from "./dto/add-workspace-members.dto";

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject("DB") private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Return all workspaces the user has access to within a given organisation
   *
   * @param userId - ID of the requesting user
   * @param organisationId - ID of the organisation to scope the query
   * @returns Array of workspace records
   */
  async findAllByOrganisation(userId: string, organisationId: string) {
    // Join through workspace_members → organisation_members to filter by user
    return this.db
      .selectDistinct({ workspace: workspaces })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaces.id, workspaceMembers.workspaceId),
      )
      .innerJoin(
        organisationMembers,
        eq(workspaceMembers.organisationMemberId, organisationMembers.id),
      )
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(workspaces.organisationId, organisationId),
        ),
      )
      .then((r) => r.map((x) => x.workspace));
  }

  /**
   * Create a new workspace and make the caller its owner
   *
   * @param organisationId - ID of the organisation the workspace belongs to
   * @param organisationMemberId - Membership ID of the creator (used to set ownership)
   * @param dto - DTO containing the workspace display name
   * @returns Newly created workspace record
   */
  async create(
    organisationId: string,
    organisationMemberId: string,
    dto: CreateWorkspaceDto,
  ) {
    // Auto-generate a unique slug: kebab-name + 8-char UUID suffix
    const slug =
      dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      crypto.randomUUID().slice(0, 8);

    // Create the workspace and the owner membership in one transaction
    return this.db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: dto.name, slug, organisationId })
        .returning();

      // The creator automatically becomes the workspace owner
      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        organisationMemberId,
        role: "owner",
      });

      return workspace;
    });
  }

  /**
   * Fetch a workspace by slug, scoped to the caller's organisation membership
   *
   * @param slug - Slug of the workspace to retrieve
   * @param organisationId - ID of the organisation the workspace must belong to
   * @param organisationMemberId - Membership ID used to verify access
   * @returns Workspace record
   * @throws NotFoundException if the workspace does not exist or the caller lacks access
   */
  async getWorkspaceBySlug(
    slug: string,
    organisationId: string,
    organisationMemberId: string,
  ) {
    // The membership join acts as an implicit access gate
    const [result] = await this.db
      .select({ workspace: workspaces })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaces.id, workspaceMembers.workspaceId),
      )
      .where(
        and(
          eq(workspaces.slug, slug),
          eq(workspaces.organisationId, organisationId),
          eq(workspaceMembers.organisationMemberId, organisationMemberId),
        ),
      )
      .limit(1);

    if (!result) {
      throw new NotFoundException("Workspace not found");
    }

    return result.workspace;
  }

  /**
   * Return the workspace membership record for a specific user and workspace slug
   *
   * @param orgMemberId - Organisation membership ID of the requesting user
   * @param workspaceSlug - Slug of the target workspace
   * @returns Workspace membership record including role, or undefined if not a member
   * @throws NotFoundException if the workspace itself does not exist
   */
  async getUserWorkspaceDetails(orgMemberId: string, workspaceSlug: string) {
    // First ensure the workspace exists before checking membership
    const [workspace] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, workspaceSlug))
      .limit(1);

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    // Fetch the membership row; returns undefined if the caller is not a member
    const [member] = await this.db
      .select()
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMembers.organisationMemberId, orgMemberId),
          eq(workspaceMembers.workspaceId, workspace.id),
        ),
      );

    return member;
  }

  /**
   * Rename a workspace
   *
   * @param userId - ID of the requesting user (must be workspace owner)
   * @param organisationId - ID of the organisation the workspace belongs to
   * @param workspaceId - UUID of the workspace to update
   * @param name - New display name for the workspace
   * @returns Updated workspace record
   * @throws ForbiddenException if the user is not the workspace owner
   */
  async updateWorkspace(
    userId: string,
    organisationId: string,
    workspaceId: string,
    name: string,
  ) {
    // Verify the caller holds the owner role in this workspace before updating
    const [member] = await this.db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .innerJoin(
        organisationMembers,
        eq(workspaceMembers.organisationMemberId, organisationMembers.id),
      )
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(workspaceMembers.role, "owner"),
          eq(workspaces.organisationId, organisationId),
          eq(workspaces.id, workspaceId),
        ),
      );

    if (!member) {
      throw new ForbiddenException(
        "Workspace not found or insufficient permissions",
      );
    }

    // Apply the rename and bump updatedAt
    const [updated] = await this.db
      .update(workspaces)
      .set({ name, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))
      .returning();

    return updated;
  }

  /**
   * Permanently delete a workspace and all its contents
   *
   * @param userId - ID of the requesting user (must be workspace owner)
   * @param organisationId - ID of the organisation the workspace belongs to
   * @param workspaceId - UUID of the workspace to delete
   * @returns Success confirmation object
   * @throws ForbiddenException if the user is not the workspace owner
   */
  async deleteWorkspace(
    userId: string,
    organisationId: string,
    workspaceId: string,
  ) {
    // Only workspace owners may delete the workspace
    const [member] = await this.db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .innerJoin(
        organisationMembers,
        eq(workspaceMembers.organisationMemberId, organisationMembers.id),
      )
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(workspaceMembers.role, "owner"),
          eq(workspaces.organisationId, organisationId),
          eq(workspaces.id, workspaceId),
        ),
      );

    if (!member) {
      throw new ForbiddenException(
        "Workspace not found or insufficient permissions",
      );
    }

    // Cascade deletes on documents and memberships are handled by FK constraints
    await this.db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    return { success: true };
  }

  /**
   * Add users to a workspace as viewers, identified by their email addresses
   *
   * @param organisationId - ID of the organisation context
   * @param organisationMemberId - Membership ID of the caller (must be workspace owner)
   * @param dto - DTO with workspaceId or workspaceSlug and the list of emails to invite
   * @returns Summary of added members and skipped emails
   * @throws ForbiddenException if workspaceId and workspaceSlug are both absent, or caller is not owner
   * @throws NotFoundException if the workspace does not exist
   */
  async addViewers(
    organisationId: string,
    organisationMemberId: string,
    dto: AddWorkspaceMembersDto,
  ) {
    const { workspaceId, workspaceSlug, emails } = dto;

    if (!workspaceId && !workspaceSlug) {
      throw new ForbiddenException("Workspace id or slug is required");
    }

    return this.db.transaction(async (tx) => {
      // Resolve the workspace by id or slug within this organisation
      const [workspace] = await tx
        .select()
        .from(workspaces)
        .where(
          and(
            eq(workspaces.organisationId, organisationId),
            workspaceId
              ? eq(workspaces.id, workspaceId)
              : eq(workspaces.slug, workspaceSlug!),
          ),
        );

      if (!workspace) {
        throw new NotFoundException("Workspace not found");
      }

      // Only workspace owners may add members
      const [owner] = await tx
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspace.id),
            eq(workspaceMembers.role, "owner"),
            eq(workspaceMembers.organisationMemberId, organisationMemberId),
          ),
        );

      if (!owner) {
        throw new ForbiddenException("Only workspace owners can add members");
      }

      // Resolve emails to organisation membership IDs — only org members can be added
      const orgMembers = await tx
        .select({
          organisationMemberId: organisationMembers.id,
          email: users.email,
        })
        .from(organisationMembers)
        .innerJoin(users, eq(organisationMembers.userId, users.id))
        .where(
          and(
            eq(organisationMembers.organisationId, organisationId),
            inArray(users.email, emails),
          ),
        );

      if (!orgMembers.length) {
        return { workspaceId: workspace.id, added: 0, skipped: emails };
      }

      // Insert memberships with viewer role; skip any already-existing entries
      const inserted = await tx
        .insert(workspaceMembers)
        .values(
          orgMembers.map((m) => ({
            workspaceId: workspace.id,
            organisationMemberId: m.organisationMemberId,
            role: "viewer" as const,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: workspaceMembers.id });

      // Report which emails were not found in the organisation
      const foundEmails = new Set(orgMembers.map((m) => m.email));
      const skippedEmails = emails.filter((e) => !foundEmails.has(e));

      return {
        workspaceId: workspace.id,
        added: inserted.length,
        skipped: skippedEmails,
      };
    });
  }
}
