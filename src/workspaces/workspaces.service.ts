import { Inject, Injectable } from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../db/schema/";
import { workspaces } from "../db/schema/workspaces";
import { workspaceMembers } from "../db/schema/workspace-members";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";

@Injectable()
export class WorkspacesService {
  constructor(@Inject("DB") private db: PostgresJsDatabase<typeof schema>) {}

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
