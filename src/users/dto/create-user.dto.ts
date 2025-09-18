import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsObject, ValidateNested } from 'class-validator';
import type { Prisma } from '@prisma/client';

export class UserPayloadDto {
  @IsString()
  @IsOptional()
  distinct_id?: string;

  @IsObject()
  @IsOptional()
  properties?: Prisma.InputJsonValue;
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @ValidateNested()
  @Type(() => UserPayloadDto)
  user: UserPayloadDto;
}
