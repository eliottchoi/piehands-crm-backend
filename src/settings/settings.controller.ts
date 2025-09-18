import { Controller, Get, Post, Body, Query, UsePipes, ValidationPipe } from '@nestjs/common';
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

  // 🎯 설정 업데이트 (임시 구현)
  @Post()
  async updateSettings(@Body() body: any) {
    console.log('🎯 Received settings update:', body);
    
    // 임시로 성공 응답만 반환
    return { 
      message: `${body.category || 'unknown'} settings saved successfully (temp mode)`,
      count: Object.keys(body.settings || {}).length,
      received: body
    };
  }

  // 🎯 연동 테스트 (SendGrid API Key 검증 등)
  @Post('test-connection')
  @UsePipes(new ValidationPipe({ transform: true }))
  async testConnection(@Body() testConnectionDto: TestConnectionDto) {
    return this.settingsService.testConnection(testConnectionDto);
  }
}
