import { IsObject, IsOptional } from 'class-validator';
import type { Prisma } from '@prisma/client';

export class UpdateUserDto {
  @IsObject()
  @IsOptional()
  properties?: Prisma.InputJsonValue;
}
