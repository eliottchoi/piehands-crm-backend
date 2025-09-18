import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';
import { Prisma } from '@prisma/client';

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  canvasDefinition?: Prisma.JsonValue;

  @IsString()
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'DRAFT', 'COMPLETED'])
  status?: string;
}
