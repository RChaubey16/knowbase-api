import { IsIn, IsString } from "class-validator";

export class UpdateOrgMemberRoleDto {
  @IsString()
  @IsIn(["owner", "admin", "member"])
  role: "owner" | "admin" | "member";
}
