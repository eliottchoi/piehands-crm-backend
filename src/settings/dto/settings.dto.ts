import { IsString, IsNotEmpty, IsObject, IsOptional, IsBoolean } from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsString()
  @IsNotEmpty()
  category: string; // 'sendgrid', 'slack', 'mixpanel'

  @IsObject()
  settings: Record<string, any>; // 설정 key-value pairs
}

export class TestConnectionDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsString()
  @IsNotEmpty()
  category: string; // 'sendgrid', 'slack', 'mixpanel'

  @IsObject()
  credentials: Record<string, string>; // 테스트할 credentials
}
