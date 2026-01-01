import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../db/schema";
import { workspaces } from "../db/schema/workspaces";
import { workspaceMembers } from "../db/schema/workspace-members";
import { organisationMembers } from "../db/schema/organisation-members";
import { users } from "../db/schema/users";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { AddWorkspaceMembersDto } from "./dto/add-workspace-members.dto";
import { OrganisationResolverService } from "src/organisations/organisation-resolver.service";

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject("DB") private db: PostgresJsDatabase<typeof schema>,
    private readonly organisationResolver: OrganisationResolverService,
  ) {}

  /**
   * Lists all workspaces for a user in an organisation
   * @param userId The ID of the user
   * @param organisationId The ID of the organisation
   * @returns An array of workspaces
   */
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

  /**
   * Creates a new workspace for a user in an organisation
   * @param userId The ID of the user
   * @param organisationId The ID of the organisation
   * @param dto The workspace creation data transfer object
   * @returns The created workspace
   */
  async create(
    userId: string,
    organisationId: string,
    dto: CreateWorkspaceDto,
  ) {
    // 1️⃣ Ensure user belongs to organisation
    const [orgMember] = await this.db
      .select()
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisationMembers.organisationId, organisationId),
        ),
      );

    if (!orgMember) {
      throw new ForbiddenException("You are not a member of this organisation");
    }

    // 2️⃣ Create workspace
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
        .values({
          name: dto.name,
          slug,
          organisationId,
        })
        .returning();

      // Creator becomes workspace owner
      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        organisationMemberId: orgMember.id,
        role: "owner",
      });

      return workspace;
    });
  }

  /**
   * Gets an workspace by slug
   * @param slug The slug of the workspace
   * @returns The workspace
   */
  async getWorkspaceBySlug(slug: string) {
    const workspace = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, slug));

    return workspace;
  }

  /**
   * Deletes a workspace for a user in an organisation
   * @param userId The ID of the user
   * @param organisationId The ID of the organisation
   * @param workspaceId The ID of the workspace
   * @returns The deleted workspace
   */
  async deleteWorkspace(
    userId: string,
    organisationId: string,
    workspaceId: string,
  ) {
    // Must be workspace owner
    const [member] = await this.db
      .select()
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

  async addViewers(userId: string, dto: AddWorkspaceMembersDto) {
    const {
      organisationId,
      organisationSlug,
      workspaceId,
      workspaceSlug,
      emails,
    } = dto;

    if (!workspaceId && !workspaceSlug) {
      throw new ForbiddenException("Workspace id or slug is required");
    }

    return this.db.transaction(async (tx) => {
      /**
       * 1️⃣ Resolve organisation
       */
      const organisation = await this.organisationResolver.resolve(
        organisationId,
        organisationSlug,
      );

      /**
       * 2️⃣ Resolve workspace
       */
      const [workspace] = await tx
        .select()
        .from(workspaces)
        .where(
          and(
            eq(workspaces.organisationId, organisation.id),
            workspaceId
              ? eq(workspaces.id, workspaceId)
              : eq(workspaces.slug, workspaceSlug!),
          ),
        );

      if (!workspace) {
        throw new ForbiddenException("Workspace not found");
      }

      /**
       * 3️⃣ Owner check
       */
      const [owner] = await tx
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .innerJoin(
          organisationMembers,
          eq(workspaceMembers.organisationMemberId, organisationMembers.id),
        )
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspace.id),
            eq(workspaceMembers.role, "owner"),
            eq(organisationMembers.userId, userId),
          ),
        );

      if (!owner) {
        throw new ForbiddenException("Only workspace owners can add members");
      }

      /**
       * 4️⃣ Fetch org members that match emails (existing users only)
       */
      const orgMembers = await tx
        .select({
          organisationMemberId: organisationMembers.id,
          email: users.email,
        })
        .from(organisationMembers)
        .innerJoin(users, eq(organisationMembers.userId, users.id))
        .where(
          and(
            eq(organisationMembers.organisationId, organisation.id),
            inArray(users.email, emails),
          ),
        );

      if (!orgMembers.length) {
        return {
          workspaceId: workspace.id,
          added: 0,
          skipped: emails,
        };
      }

      /**
       * 5️⃣ Insert viewers (DB handles duplicates)
       */
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

      /**
       * 6️⃣ Compute skipped emails
       */
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
