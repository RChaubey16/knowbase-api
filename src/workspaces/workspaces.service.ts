import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, count, eq, inArray } from "drizzle-orm";
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
    @Inject("DB") private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findAllByOrganisation(userId: string, organisationId: string) {
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

  async create(
    organisationId: string,
    organisationMemberId: string,
    dto: CreateWorkspaceDto,
  ) {
    const slug =
      dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      crypto.randomUUID().slice(0, 8);

    return this.db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: dto.name, slug, organisationId })
        .returning();

      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        organisationMemberId,
        role: "owner",
      });

      return workspace;
    });
  }

  async getWorkspaceBySlug(
    slug: string,
    organisationId: string,
    organisationMemberId: string,
  ) {
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

  async getUserWorkspaceDetails(orgMemberId: string, workspaceSlug: string) {
    const [workspace] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, workspaceSlug))
      .limit(1);

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

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

  async updateWorkspace(
    userId: string,
    organisationId: string,
    workspaceId: string,
    name: string,
  ) {
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

    const [updated] = await this.db
      .update(workspaces)
      .set({ name, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))
      .returning();

    return updated;
  }

  async deleteWorkspace(
    userId: string,
    organisationId: string,
    workspaceId: string,
  ) {
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

    await this.db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    return { success: true };
  }

  async listWorkspaceMembers(
    workspaceSlugOrId: string,
    organisationId: string,
    organisationMemberId: string,
  ) {
    const [workspace] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaces.id, workspaceMembers.workspaceId),
      )
      .where(
        and(
          eq(workspaces.organisationId, organisationId),
          eq(workspaceMembers.organisationMemberId, organisationMemberId),
          workspaceSlugOrId.includes("-") && workspaceSlugOrId.length === 36
            ? eq(workspaces.id, workspaceSlugOrId)
            : eq(workspaces.slug, workspaceSlugOrId),
        ),
      )
      .limit(1);

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return this.db
      .select({
        id: workspaceMembers.id,
        organisationMemberId: workspaceMembers.organisationMemberId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        avatar: users.avatar,
      })
      .from(workspaceMembers)
      .innerJoin(
        organisationMembers,
        eq(workspaceMembers.organisationMemberId, organisationMembers.id),
      )
      .innerJoin(users, eq(organisationMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspace.id));
  }

  async removeWorkspaceMember(
    targetMemberId: string,
    organisationId: string,
    requestingOrgMemberId: string,
  ) {
    const [target] = await this.db
      .select({ id: workspaceMembers.id, workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMembers.id, targetMemberId),
          eq(workspaces.organisationId, organisationId),
        ),
      )
      .limit(1);

    if (!target) {
      throw new NotFoundException("Workspace member not found");
    }

    const [requester] = await this.db
      .select({ id: workspaceMembers.id, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, target.workspaceId),
          eq(workspaceMembers.organisationMemberId, requestingOrgMemberId),
        ),
      )
      .limit(1);

    if (!requester || requester.role !== "owner") {
      throw new ForbiddenException(
        "Only workspace owners can remove members",
      );
    }

    if (target.role === "owner") {
      const [{ ownerCount }] = await this.db
        .select({ ownerCount: count() })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, target.workspaceId),
            eq(workspaceMembers.role, "owner"),
          ),
        );

      if (ownerCount <= 1) {
        throw new ForbiddenException(
          "Cannot remove the last owner of a workspace",
        );
      }
    }

    await this.db
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.id, targetMemberId));

    return { success: true };
  }

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
