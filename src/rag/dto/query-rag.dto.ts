import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class QueryRagDto {
  @IsUUID()
  workspaceId: string;

  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}
