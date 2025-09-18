import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  ValidateIf,
  IsEmail,
} from 'class-validator';

class UserToIdentifyPropertiesDto {
  @IsEmail()
  @IsOptional()
  email?: string;
}

class UserToIdentifyDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => UserToIdentifyPropertiesDto)
  properties?: UserToIdentifyPropertiesDto;

  // This custom validation ensures that either 'id' or 'properties.email' exists, but not both.
  @ValidateIf(o => !o.id && !o.properties?.email)
  @IsNotEmpty({ message: 'Either id or properties.email must be provided.' })
  private readonly eitherIdOrEmail: undefined;

  @ValidateIf(o => o.id && o.properties?.email)
  @IsNotEmpty({ message: 'Provide either id or properties.email, not both.' })
  private readonly notBothIdAndEmail: undefined;
}

export class IdentifyUserDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UserToIdentifyDto)
  userToIdentify: UserToIdentifyDto;

  @IsString()
  @IsNotEmpty()
  newDistinctId: string;
}
