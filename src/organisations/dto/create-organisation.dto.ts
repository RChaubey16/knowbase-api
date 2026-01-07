import { IsNotEmpty, IsString, Length } from "class-validator";

export class CreateOrganisationDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  slug: string;
}
