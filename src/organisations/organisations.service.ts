import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";

import * as schema from "../db/schema";
import { organisations } from "../db/schema/organisations";
import { organisationMembers } from "../db/schema/organisation-members";

@Injectable()
export class OrganisationsService {
  constructor(
    @Inject("DB")
    private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async createOrganisation(userId: string, name: string, slug: string) {
    // 🔒 Free-tier rule: user can own only ONE organisation
    const ownedOrgs = await this.db
      .select()
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisationMembers.role, "owner"),
        ),
      );

    if (ownedOrgs.length >= 1) {
      throw new ForbiddenException("Free tier allows only one organisation");
    }

    const [org] = await this.db
      .insert(organisations)
      .values({
        name,
        slug,
        createdBy: userId,
      })
      .returning();

    // Creator becomes OWNER
    await this.db.insert(organisationMembers).values({
      organisationId: org.id,
      userId,
      role: "owner",
    });

    return org;
  }

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
