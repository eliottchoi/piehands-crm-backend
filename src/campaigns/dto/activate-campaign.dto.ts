import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
} from 'class-validator';

export enum TargetUserGroup {
  ALL_USERS = 'ALL_USERS',
  SPECIFIC_USERS = 'SPECIFIC_USERS',
  BY_SEGMENT = 'BY_SEGMENT',
}

export class ActivateCampaignDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsEnum(TargetUserGroup)
  targetGroup: TargetUserGroup;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specificUserIds?: string[]; // SPECIFIC_USERS일 때 사용

  @IsOptional()
  @IsString()
  segmentFilter?: string; // BY_SEGMENT일 때 사용 (JSON 형태)
}
