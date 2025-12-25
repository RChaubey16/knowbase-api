import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";

import * as schema from "../db/schema";
import { organisations } from "../db/schema/organisations";
import { organisationMembers } from "../db/schema/organisation-members";
import { PostgresError } from "postgres";
import { DrizzleQueryError } from "drizzle-orm";

@Injectable()
export class OrganisationsService {
  constructor(
    @Inject("DB")
    private db: PostgresJsDatabase<typeof schema>,
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
        err.cause instanceof PostgresError &&
        err.cause.code === "23505"
      ) {
        throw new BadRequestException("Slug is already taken");
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
}
