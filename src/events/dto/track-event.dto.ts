import { IsString, IsNotEmpty, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class EventDto {
  @IsString()
  @IsNotEmpty()
  userId: string; // distinct_id of the user

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  timestamp?: string; // ISO 8601 format, optional

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;
}

export class TrackEventDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @ValidateNested()
  @Type(() => EventDto)
  event: EventDto;
}
