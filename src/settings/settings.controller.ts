import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto, TestConnectionDto } from './dto/settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // 🎯 워크스페이스 설정 조회
  @Get()
  async getSettings(@Query('workspaceId') workspaceId: string) {
    return this.settingsService.getWorkspaceSettings(workspaceId);
  }

  // 🎯 설정 업데이트
  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateSettings(@Body() updateSettingsDto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(updateSettingsDto);
  }

  // 🎯 연동 테스트 (SendGrid API Key 검증 등)
  @Post('test-connection')
  @UsePipes(new ValidationPipe({ transform: true }))
  async testConnection(@Body() testConnectionDto: TestConnectionDto) {
    return this.settingsService.testConnection(testConnectionDto);
  }
}
