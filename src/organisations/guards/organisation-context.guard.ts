import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import * as schema from "../../db/schema";
import { RequestWithJwtAndOrg } from "../interfaces/request-with-org.interface";
import { isUUID } from "class-validator";

@Injectable()
export class OrganisationContextGuard implements CanActivate {
  constructor(
    @Inject("DB")
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithJwtAndOrg>();

    const user = request.user;
    const organisationHeader = request.headers["x-organisation"];

    if (!user) {
      throw new UnauthorizedException();
    }

    if (!organisationHeader) {
      throw new ForbiddenException("Organisation context missing");
    }

    const organisationValue = Array.isArray(organisationHeader)
      ? organisationHeader[0]
      : organisationHeader;

    const isUuid = isUUID(organisationValue);

    // 1️⃣ Resolve organisation by ID OR slug
    const [organisation] = await this.db
      .select({ id: schema.organisations.id })
      .from(schema.organisations)
      .where(
        isUuid
          ? eq(schema.organisations.id, organisationValue)
          : eq(schema.organisations.slug, organisationValue),
      )
      .limit(1);

    if (!organisation) {
      throw new ForbiddenException("Organisation not found");
    }

    // 2️⃣ Validate membership using resolved organisationId
    const [membership] = await this.db
      .select({
        organisationMemberId: schema.organisationMembers.id,
        role: schema.organisationMembers.role,
      })
      .from(schema.organisationMembers)
      .where(
        and(
          eq(schema.organisationMembers.organisationId, organisation.id),
          eq(schema.organisationMembers.userId, user.userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException("You are not a member of this organisation");
    }

    // 3️⃣ Attach resolved context
    request.organisation = {
      organisationId: organisation.id,
      organisationMemberId: membership.organisationMemberId,
      role: membership.role,
    };

    return true;
  }
}
