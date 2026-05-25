import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and, inArray, count } from "drizzle-orm";

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
    private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async createOrganisation(userId: string, name: string, slug: string) {
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
      return await this.db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organisations)
          .values({ name, slug, createdBy: userId })
          .returning();

        await tx.insert(organisationMembers).values({
          organisationId: org.id,
          userId,
          role: "owner",
        });

        return org;
      });
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

  async getOrganisationBySlug(slug: string, userId: string) {
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

  async getUserOrgDetails(userId: string, organisationSlug: string) {
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

  async addOrganisationMembers(
    organisationId: string,
    organisationMemberId: string,
    dto: AddOrganisationMembersDto,
  ) {
    const { emails } = dto;

    return this.db.transaction(async (tx) => {
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

      const existingUsers = await tx
        .select({ userId: users.id, email: users.email })
        .from(users)
        .where(inArray(users.email, emails));

      if (!existingUsers.length) {
        return { organisationId, added: 0, skipped: emails };
      }

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

      const foundEmails = new Set(existingUsers.map((u) => u.email));
      const skippedEmails = emails.filter((e) => !foundEmails.has(e));

      return { organisationId, added: inserted.length, skipped: skippedEmails };
    });
  }

  async updateOrganisation(userId: string, orgId: string, name: string) {
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

    const [updated] = await this.db
      .update(organisations)
      .set({ name, updatedAt: new Date() })
      .where(eq(organisations.id, orgId))
      .returning();

    return updated;
  }

  async listOrganisationMembers(slug: string, requestingUserId: string) {
    const [org] = await this.db
      .select({ id: organisations.id })
      .from(organisations)
      .innerJoin(
        organisationMembers,
        eq(organisations.id, organisationMembers.organisationId),
      )
      .where(
        and(
          eq(organisations.slug, slug),
          eq(organisationMembers.userId, requestingUserId),
        ),
      )
      .limit(1);

    if (!org) {
      throw new NotFoundException("Organisation not found");
    }

    return this.db
      .select({
        id: organisationMembers.id,
        userId: organisationMembers.userId,
        role: organisationMembers.role,
        joinedAt: organisationMembers.joinedAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        avatar: users.avatar,
      })
      .from(organisationMembers)
      .innerJoin(users, eq(organisationMembers.userId, users.id))
      .where(eq(organisationMembers.organisationId, org.id));
  }

  async removeOrganisationMember(
    requestingUserId: string,
    targetMemberId: string,
  ) {
    const [target] = await this.db
      .select()
      .from(organisationMembers)
      .where(eq(organisationMembers.id, targetMemberId))
      .limit(1);

    if (!target) {
      throw new NotFoundException("Member not found");
    }

    const [requester] = await this.db
      .select({ id: organisationMembers.id, role: organisationMembers.role })
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.organisationId, target.organisationId),
          eq(organisationMembers.userId, requestingUserId),
        ),
      )
      .limit(1);

    if (!requester || !["owner", "admin"].includes(requester.role)) {
      throw new ForbiddenException(
        "Only organisation owners or admins can remove members",
      );
    }

    if (target.role === "owner" && requester.role !== "owner") {
      throw new ForbiddenException("Admins cannot remove owners");
    }

    if (target.role === "owner") {
      const [{ ownerCount }] = await this.db
        .select({ ownerCount: count() })
        .from(organisationMembers)
        .where(
          and(
            eq(organisationMembers.organisationId, target.organisationId),
            eq(organisationMembers.role, "owner"),
          ),
        );

      if (ownerCount <= 1) {
        throw new ForbiddenException(
          "Cannot remove the last owner of an organisation",
        );
      }
    }

    await this.db
      .delete(organisationMembers)
      .where(eq(organisationMembers.id, targetMemberId));

    return { success: true };
  }

  async updateOrganisationMemberRole(
    requestingUserId: string,
    targetMemberId: string,
    role: "owner" | "admin" | "member",
  ) {
    const [target] = await this.db
      .select()
      .from(organisationMembers)
      .where(eq(organisationMembers.id, targetMemberId))
      .limit(1);

    if (!target) {
      throw new NotFoundException("Member not found");
    }

    const [requester] = await this.db
      .select({ id: organisationMembers.id, role: organisationMembers.role })
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.organisationId, target.organisationId),
          eq(organisationMembers.userId, requestingUserId),
        ),
      )
      .limit(1);

    if (!requester || requester.role !== "owner") {
      throw new ForbiddenException(
        "Only organisation owners can change member roles",
      );
    }

    if (target.role === "owner" && role !== "owner") {
      const [{ ownerCount }] = await this.db
        .select({ ownerCount: count() })
        .from(organisationMembers)
        .where(
          and(
            eq(organisationMembers.organisationId, target.organisationId),
            eq(organisationMembers.role, "owner"),
          ),
        );

      if (ownerCount <= 1) {
        throw new ForbiddenException(
          "Cannot demote the last owner of an organisation",
        );
      }
    }

    const [updated] = await this.db
      .update(organisationMembers)
      .set({ role })
      .where(eq(organisationMembers.id, targetMemberId))
      .returning();

    return updated;
  }

  async deleteOrganisation(userId: string, organisationId: string) {
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

    await this.db
      .delete(organisations)
      .where(eq(organisations.id, organisationId));

    return { success: true };
  }
}
