import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../db/schema";
import { organisations } from "../db/schema/organisations";

@Injectable()
export class OrganisationResolverService {
  constructor(@Inject("DB") private db: PostgresJsDatabase<typeof schema>) {}

  async resolve(organisationId?: string, organisationSlug?: string) {
    if (!organisationId && !organisationSlug) {
      throw new ForbiddenException("Organisation id or slug is required");
    }

    const [org] = await this.db
      .select()
      .from(organisations)
      .where(
        organisationId
          ? eq(organisations.id, organisationId)
          : eq(organisations.slug, organisationSlug!),
      );

    if (!org) {
      throw new ForbiddenException("Organisation not found");
    }

    return org;
  }
}
