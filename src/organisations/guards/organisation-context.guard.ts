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

@Injectable()
export class OrganisationContextGuard implements CanActivate {
  constructor(
    @Inject("DB")
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithJwtAndOrg>();

    const user = request.user;
    const organisationIdHeader = request.headers["x-organisation-id"];

    if (!user) {
      throw new UnauthorizedException();
    }

    if (!organisationIdHeader) {
      throw new ForbiddenException("Organisation context missing");
    }

    // Normalize header value to string (headers can be string | string[])
    const organisationId = Array.isArray(organisationIdHeader)
      ? organisationIdHeader[0]
      : organisationIdHeader;

    const [membership] = await this.db
      .select({
        organisationMemberId: schema.organisationMembers.id,
        role: schema.organisationMembers.role,
      })
      .from(schema.organisationMembers)
      .where(
        and(
          eq(schema.organisationMembers.organisationId, organisationId),
          eq(schema.organisationMembers.userId, user.userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException("You are not a member of this organisation");
    }

    request.organisation = {
      organisationId,
      organisationMemberId: membership.organisationMemberId,
      role: membership.role,
    };

    return true;
  }
}
