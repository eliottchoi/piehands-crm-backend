import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  createdBy: string;
}
