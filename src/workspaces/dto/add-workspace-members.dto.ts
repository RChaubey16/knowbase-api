import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  ArrayNotEmpty,
} from "class-validator";

export class AddWorkspaceMembersDto {
  // Organisation identifier
  @IsOptional()
  @IsString()
  organisationId?: string;

  @IsOptional()
  @IsString()
  organisationSlug?: string;

  // Workspace identifier
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  workspaceSlug?: string;

  // Emails to add
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[];
}
