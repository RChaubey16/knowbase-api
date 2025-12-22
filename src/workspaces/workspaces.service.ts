import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../db/schema";
import { workspaces } from "../db/schema/workspaces";
import { workspaceMembers } from "../db/schema/workspace-members";
import { organisationMembers } from "../db/schema/organisation-members";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";

@Injectable()
export class WorkspacesService {
  constructor(@Inject("DB") private db: PostgresJsDatabase<typeof schema>) {}

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
}
