import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsIn(["text", "url", "pdf"])
  type: "text" | "url" | "pdf";

  @IsOptional()
  @IsString()
  source?: string;

  @IsBoolean()
  isIndexed: boolean;
}
