import { IsArray, IsEmail, IsOptional, IsString, ArrayNotEmpty, IsIn } from "class-validator";

export class AddOrganisationMembersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[];

  @IsOptional()
  @IsString()
  @IsIn(["owner", "admin", "member"])
  role?: string;
}
