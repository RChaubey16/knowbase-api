import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and, inArray } from "drizzle-orm";

import * as schema from "../db/schema";
import { users } from "../db/schema";
import { organisations } from "../db/schema/organisations";
import { organisationMembers } from "../db/schema/organisation-members";
import { PostgresError } from "postgres";
import { DrizzleQueryError } from "drizzle-orm";
import { AddOrganisationMembersDto } from "./dto/add-org-members.dto";

@Injectable()
export class OrganisationsService {
  constructor(
    @Inject("DB")
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Create a new organisation and make the caller its owner
   *
   * @param userId - ID of the user creating the organisation
   * @param name - Display name for the organisation
   * @param slug - Globally unique URL slug chosen by the user
   * @returns Newly created organisation record
   * @throws ForbiddenException if the user already owns 3 organisations
   * @throws BadRequestException if the slug is already taken
   */
  async createOrganisation(userId: string, name: string, slug: string) {
    // Enforce the 3-org limit before touching the write path
    const ownedOrgs = await this.db
      .select({ id: organisationMembers.id })
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisationMembers.role, "owner"),
        ),
      );

    if (ownedOrgs.length >= 3) {
      throw new ForbiddenException(
        "You have reached the maximum of 3 organisations",
      );
    }

    try {
      // Create the org and the owner membership atomically
      return await this.db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organisations)
          .values({ name, slug, createdBy: userId })
          .returning();

        // Insert the creator as owner so they can manage the org immediately
        await tx.insert(organisationMembers).values({
          organisationId: org.id,
          userId,
          role: "owner",
        });

        return org;
      });
    } catch (err) {
      // Surface a user-friendly message for the unique constraint on slug
      if (
        err instanceof DrizzleQueryError &&
        err.cause instanceof PostgresError
      ) {
        if (
          err.cause.code === "23505" &&
          err.cause.constraint_name === "organisations_slug_unique"
        ) {
          throw new BadRequestException("Slug already exists");
        }
      }
      throw err;
    }
  }

  /**
   * List every organisation the user is a member of, along with their role
   *
   * @param userId - ID of the requesting user
   * @returns Array of organisations with the user's role in each
   */
  async listUserOrganisations(userId: string) {
    // Join through organisation_members to filter by the calling user
    return this.db
      .select({
        id: organisations.id,
        name: organisations.name,
        slug: organisations.slug,
        role: organisationMembers.role,
      })
      .from(organisationMembers)
      .innerJoin(
        organisations,
        eq(organisationMembers.organisationId, organisations.id),
      )
      .where(eq(organisationMembers.userId, userId));
  }

  /**
   * Fetch a single organisation by its slug, scoped to the calling user's membership
   *
   * @param slug - URL slug of the organisation
   * @param userId - ID of the requesting user
   * @returns Organisation record
   * @throws NotFoundException if the organisation does not exist or the user is not a member
   */
  async getOrganisationBySlug(slug: string, userId: string) {
    // The membership join doubles as an access check — non-members get a 404
    const [result] = await this.db
      .select({
        id: organisations.id,
        name: organisations.name,
        slug: organisations.slug,
        createdAt: organisations.createdAt,
        updatedAt: organisations.updatedAt,
      })
      .from(organisations)
      .innerJoin(
        organisationMembers,
        eq(organisations.id, organisationMembers.organisationId),
      )
      .where(
        and(
          eq(organisations.slug, slug),
          eq(organisationMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!result) {
      throw new NotFoundException("Organisation not found");
    }

    return result;
  }

  /**
   * Return the full membership record for a user within a specific organisation
   *
   * @param userId - ID of the requesting user
   * @param organisationSlug - Slug of the organisation to look up
   * @returns Organisation membership record including role
   * @throws NotFoundException if the user is not a member of the organisation
   */
  async getUserOrgDetails(userId: string, organisationSlug: string) {
    // Fetch the raw membership row so the caller can inspect role and timestamps
    const [result] = await this.db
      .select()
      .from(organisationMembers)
      .innerJoin(
        organisations,
        eq(organisationMembers.organisationId, organisations.id),
      )
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisations.slug, organisationSlug),
        ),
      )
      .limit(1);

    if (!result) {
      throw new NotFoundException("Organisation membership not found");
    }

    return result;
  }

  /**
   * Invite one or more users to an organisation by email address
   *
   * @param organisationId - ID of the target organisation
   * @param organisationMemberId - Membership ID of the caller (must be owner or admin)
   * @param dto - DTO containing the list of email addresses to invite
   * @returns Summary of how many members were added and which emails were skipped
   * @throws ForbiddenException if the caller is not an owner or admin
   */
  async addOrganisationMembers(
    organisationId: string,
    organisationMemberId: string,
    dto: AddOrganisationMembersDto,
  ) {
    const { emails } = dto;

    return this.db.transaction(async (tx) => {
      // Verify the caller has permission before doing any writes
      const [admin] = await tx
        .select({ id: organisationMembers.id })
        .from(organisationMembers)
        .where(
          and(
            eq(organisationMembers.id, organisationMemberId),
            inArray(organisationMembers.role, ["owner", "admin"]),
          ),
        );

      if (!admin) {
        throw new ForbiddenException(
          "Only organisation owners or admins can invite members",
        );
      }

      // Resolve emails to user IDs — only registered users can be invited
      const existingUsers = await tx
        .select({ userId: users.id, email: users.email })
        .from(users)
        .where(inArray(users.email, emails));

      if (!existingUsers.length) {
        return { organisationId, added: 0, skipped: emails };
      }

      // Insert with onConflictDoNothing to silently skip already-members
      const inserted = await tx
        .insert(organisationMembers)
        .values(
          existingUsers.map((u) => ({
            organisationId,
            userId: u.userId,
            role: "member" as const,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: organisationMembers.id });

      // Determine which emails were not found in the users table
      const foundEmails = new Set(existingUsers.map((u) => u.email));
      const skippedEmails = emails.filter((e) => !foundEmails.has(e));

      return { organisationId, added: inserted.length, skipped: skippedEmails };
    });
  }

  /**
   * Update the display name of an organisation
   *
   * @param userId - ID of the requesting user (must be owner)
   * @param orgId - ID of the organisation to update
   * @param name - New display name
   * @returns Updated organisation record
   * @throws ForbiddenException if the user is not the organisation owner
   */
  async updateOrganisation(userId: string, orgId: string, name: string) {
    // Confirm ownership before allowing the update
    const [member] = await this.db
      .select({ id: organisationMembers.id })
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisationMembers.role, "owner"),
          eq(organisationMembers.organisationId, orgId),
        ),
      );

    if (!member) {
      throw new ForbiddenException(
        "Organisation not found or insufficient permissions",
      );
    }

    // Apply the name change and bump updatedAt
    const [updated] = await this.db
      .update(organisations)
      .set({ name, updatedAt: new Date() })
      .where(eq(organisations.id, orgId))
      .returning();

    return updated;
  }

  /**
   * Permanently delete an organisation and all its dependent data
   *
   * @param userId - ID of the requesting user (must be owner)
   * @param organisationId - ID of the organisation to delete
   * @returns Success confirmation object
   * @throws ForbiddenException if the user is not the organisation owner
   */
  async deleteOrganisation(userId: string, organisationId: string) {
    // Only the owner can delete the organisation
    const [member] = await this.db
      .select({ id: organisationMembers.id })
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisationMembers.role, "owner"),
          eq(organisationMembers.organisationId, organisationId),
        ),
      );

    if (!member) {
      throw new ForbiddenException(
        "Organisation not found or insufficient permissions",
      );
    }

    // Cascade deletes on foreign keys handle members, workspaces, and documents
    await this.db
      .delete(organisations)
      .where(eq(organisations.id, organisationId));

    return { success: true };
  }
}
