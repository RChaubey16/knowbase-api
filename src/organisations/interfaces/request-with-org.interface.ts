import { RequestWithJwtUser } from "../../auth/interfaces/request-with-jwt-user.interface";

export interface OrganisationContext {
  organisationId: string;
  organisationMemberId: string;
  role: "owner" | "admin" | "member";
}

export interface RequestWithOrganisation {
  organisation: OrganisationContext;
}

export type RequestWithJwtAndOrg = RequestWithJwtUser & RequestWithOrganisation;
