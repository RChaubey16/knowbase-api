import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsIn(["text", "url", "pdf"])
  type: "text" | "url" | "pdf";

  @IsOptional()
  @IsString()
  source?: string;

  @IsBoolean()
  isIndexed: boolean;
}
