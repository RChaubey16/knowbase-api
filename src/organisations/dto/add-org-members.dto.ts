import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  IsEnum,
} from "class-validator";
import { workspaceRoleEnum } from "src/db/schema";

export class AddOrganisationMembersDto {
  // Organisation identifier
  @IsOptional()
  @IsString()
  organisationId?: string;

  @IsOptional()
  @IsString()
  organisationSlug?: string;

  // Emails to add
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[];

  @IsOptional()
  @IsString()
  @IsEnum(workspaceRoleEnum)
  role?: string;
}
