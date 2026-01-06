/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  content: string;

  @IsNotEmpty()
  isIndexed: boolean;
}
