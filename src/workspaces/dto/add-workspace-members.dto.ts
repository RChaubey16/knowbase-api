import { IsArray, IsEmail, IsOptional, IsString, ArrayNotEmpty, IsIn } from "class-validator";

export class AddWorkspaceMembersDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  workspaceSlug?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[];

  @IsOptional()
  @IsString()
  @IsIn(["owner", "admin", "editor", "viewer"])
  role?: string;
}
