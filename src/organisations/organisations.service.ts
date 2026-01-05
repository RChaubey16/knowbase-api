import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and, inArray } from "drizzle-orm";

import * as schema from "../db/schema";
import { users } from "../db/schema";
import { organisations } from "../db/schema/organisations";
import { organisationMembers } from "../db/schema/organisation-members";
import { PostgresError } from "postgres";
import { DrizzleQueryError } from "drizzle-orm";
import { OrganisationResolverService } from "./organisation-resolver.service";
import { AddOrganisationMembersDto } from "./dto/add-org-members.dto";

@Injectable()
export class OrganisationsService {
  constructor(
    @Inject("DB")
    private db: PostgresJsDatabase<typeof schema>,
    private readonly organisationResolver: OrganisationResolverService,
  ) {}

  /**
   * Creates a new organisation for a user
   * @param userId The ID of the user creating the organisation
   * @param name The name of the organisation
   * @param slug The slug of the organisation
   * @returns The created organisation
   */
  async createOrganisation(userId: string, name: string, slug: string) {
    // Free-tier rule
    const ownedOrgs = await this.db
      .select()
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisationMembers.role, "owner"),
        ),
      );

    if (ownedOrgs.length >= 3) {
      throw new ForbiddenException("Free tier allows only one organisation");
    }

    try {
      const [org] = await this.db
        .insert(organisations)
        .values({
          name,
          slug,
          createdBy: userId,
        })
        .returning();

      await this.db.insert(organisationMembers).values({
        organisationId: org.id,
        userId,
        role: "owner",
      });

      return org;
    } catch (err) {
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
   * Lists all organisations for a user
   * @param userId The ID of the user
   * @returns An array of organisations
   */
  async listUserOrganisations(userId: string) {
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
   * Gets an organisation by slug
   * @param slug The slug of the organisation
   * @returns The organisation
   */
  async getOrganisationBySlug(slug: string) {
    const org = await this.db
      .select()
      .from(organisations)
      .where(eq(organisations.slug, slug));

    return org;
  }

  /**
   * Checks if a user is a member of an organisation
   * @param userId The ID of the user
   * @param organisationId The ID of the organisation
   * @returns True if the user is a member of the organisation, false otherwise
   */
  async isUserMemberOfOrg(userId: string, organisationId: string) {
    const [member] = await this.db
      .select()
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisationMembers.organisationId, organisationId),
        ),
      );

    return !!member;
  }

  /**
   * Gets the details of an organisation for a user
   * @param userId The ID of the user
   * @param organisationSlug The slug of the organisation
   * @returns The organisation details
   */
  async getUserOrgDetails(userId: string, organisationSlug: string) {
    const organisation = await this.organisationResolver.resolve(
      "",
      organisationSlug,
    );

    if (!organisation) {
      throw new ForbiddenException("Organisation not found");
    }

    const { id } = organisation;

    const [member] = await this.db
      .select()
      .from(organisationMembers)
      .innerJoin(
        organisations,
        eq(organisationMembers.organisationId, organisations.id),
      )
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisationMembers.organisationId, id),
        ),
      );

    return member;
  }

  /**
   * Adds members to an organisation
   * @param userId The ID of the user adding the members
   * @param dto The DTO containing the organisation ID, organisation slug, and emails
   * @returns The added members
   */
  async addOrganisationMembers(userId: string, dto: AddOrganisationMembersDto) {
    const { organisationId, organisationSlug, emails } = dto;

    return this.db.transaction(async (tx) => {
      /**
       * 1️⃣ Resolve organisation
       */
      const organisation = await this.organisationResolver.resolve(
        organisationId,
        organisationSlug,
      );

      /**
       * 2️⃣ Owner / admin check (org-level authority)
       */
      const [admin] = await tx
        .select({ id: organisationMembers.id })
        .from(organisationMembers)
        .where(
          and(
            eq(organisationMembers.organisationId, organisation.id),
            eq(organisationMembers.userId, userId),
            inArray(organisationMembers.role, ["owner", "admin"]),
          ),
        );

      if (!admin) {
        throw new ForbiddenException(
          "Only organisation owners or admins can invite members",
        );
      }

      /**
       * 3️⃣ Resolve existing users by email
       */
      const existingUsers = await tx
        .select({
          userId: users.id,
          email: users.email,
        })
        .from(users)
        .where(inArray(users.email, emails));

      if (!existingUsers.length) {
        return {
          organisationId: organisation.id,
          added: 0,
          skipped: emails,
        };
      }

      /**
       * 4️⃣ Insert organisation members as viewers
       *     DB uniqueness prevents duplicates
       */
      const inserted = await tx
        .insert(organisationMembers)
        .values(
          existingUsers.map((u) => ({
            organisationId: organisation.id,
            userId: u.userId,
            role: "member" as const, // viewer-equivalent at org level
          })),
        )
        .onConflictDoNothing()
        .returning({ id: organisationMembers.id });

      /**
       * 5️⃣ Compute skipped emails
       */
      const foundEmails = new Set(existingUsers.map((u) => u.email));
      const skippedEmails = emails.filter((e) => !foundEmails.has(e));

      return {
        organisationId: organisation.id,
        added: inserted.length,
        skipped: skippedEmails,
      };
    });
  }

  /**
   * Deletes an organisation
   * @param userId The ID of the user deleting the organisation
   * @param organisationId The ID of the organisation
   * @returns The deleted organisation
   */
  async deleteOrganisation(userId: string, organisationId: string) {
    // Must be organisation owner
    const [member] = await this.db
      .select()
      .from(organisationMembers)
      .innerJoin(
        organisations,
        eq(organisationMembers.organisationId, organisations.id),
      )
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

    await this.db
      .delete(organisations)
      .where(eq(organisations.id, organisationId));

    return { success: true };
  }
}
