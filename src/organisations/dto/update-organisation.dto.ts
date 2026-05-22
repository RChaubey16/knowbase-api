import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class UpdateOrganisationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
