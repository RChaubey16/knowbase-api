import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../db/schema/";
import { workspaces } from "../db/schema/workspaces";
import { workspaceMembers } from "../db/schema/workspace-members";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";

@Injectable()
export class WorkspacesService {
  constructor(@Inject("DB") private db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Finds all workspaces the user is a member of.
   * @param userId The ID of the user.
   * @returns A list of workspaces.
   */
  async findAllWorkspacesByUser(userId: string) {
    const results = await this.db
      .select({
        workspace: workspaces,
      })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaces.id, workspaceMembers.workspaceId),
      )
      .where(eq(workspaceMembers.userId, userId));

    return results.map((r) => r.workspace);
  }

  /**
   * Creates a new workspace for the user.
   * @param userId The ID of the user creating the workspace.
   * @param createWorkspaceDto The data transfer object containing the workspace name.
   * @returns The created workspace.
   */
  async create(userId: string, createWorkspaceDto: CreateWorkspaceDto) {
    const { name } = createWorkspaceDto;
    const slug =
      name.toLowerCase().replace(/ /g, "-") +
      "-" +
      Math.random().toString(36).substring(2, 7);

    return await this.db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({
          name,
          slug,
          ownerId: userId,
        })
        .returning();

      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId,
        role: "owner",
      });

      return workspace;
    });
  }
}
