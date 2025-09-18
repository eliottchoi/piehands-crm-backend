import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export enum TargetUserGroup {
  ALL_USERS = 'ALL_USERS',
  // In the future, we can add more groups like 'BY_SEGMENT', etc.
}

export class SendCampaignDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsEnum(TargetUserGroup)
  targetGroup: TargetUserGroup;
}
