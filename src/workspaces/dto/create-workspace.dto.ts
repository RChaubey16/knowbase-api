import { IsNotEmpty, IsString, Length } from "class-validator";

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;
}
