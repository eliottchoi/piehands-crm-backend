import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto, TestConnectionDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  // 🎯 워크스페이스 설정 조회 (메모리 캐시에서)
  async getWorkspaceSettings(workspaceId: string) {
    this.logger.log(`Getting settings for workspace: ${workspaceId}`);
    
    // 💾 메모리 캐시에서 조회
    const sendgridSettings = this.settingsCache.get(`${workspaceId}:sendgrid`) || {};
    const slackSettings = this.settingsCache.get(`${workspaceId}:slack`) || {};
    const mixpanelSettings = this.settingsCache.get(`${workspaceId}:mixpanel`) || {};

    return {
      sendgrid: sendgridSettings,
      slack: slackSettings,
      mixpanel: mixpanelSettings,
    };
  }

  // 🎯 설정 업데이트 (임시 메모리 저장)
  private settingsCache = new Map<string, Record<string, any>>();

  async updateSettings(dto: UpdateSettingsDto) {
    const { workspaceId, category, settings } = dto;

    this.logger.log(`Updating ${category} settings for workspace ${workspaceId}`);

    // 💾 임시로 메모리에 저장 (실제 DB 연동 전까지)
    const cacheKey = `${workspaceId}:${category}`;
    this.settingsCache.set(cacheKey, settings);

    this.logger.log(`Successfully cached ${Object.keys(settings).length} ${category} settings`);

    return { 
      message: `${category} settings saved successfully (cache mode)`,
      count: Object.keys(settings).length 
    };
  }

  // 🎯 연동 테스트
  async testConnection(dto: TestConnectionDto) {
    const { category, credentials } = dto;

    this.logger.log(`Testing ${category} connection`);

    switch (category) {
      case 'sendgrid':
        return this.testSendGridConnection(credentials);
      case 'slack':
        return this.testSlackConnection(credentials);
      case 'mixpanel':
        return this.testMixpanelConnection(credentials);
      default:
        throw new BadRequestException(`Unsupported integration: ${category}`);
    }
  }

  // 🎯 SendGrid 연결 테스트 (간단 검증)
  private async testSendGridConnection(credentials: Record<string, string>) {
    try {
      const { api_key } = credentials;
      
      if (!api_key || !api_key.startsWith('SG.')) {
        return {
          success: false,
          message: 'Invalid SendGrid API key format. Must start with "SG."'
        };
      }

      if (api_key.length < 50) {
        return {
          success: false,
          message: 'SendGrid API key appears too short'
        };
      }

      // TODO: 실제 SendGrid API 테스트 (순환 의존성 해결 후)
      return {
        success: true,
        message: 'SendGrid API key format is valid! (Connection test will be implemented)',
        details: { keyLength: api_key.length }
      };

    } catch (error) {
      this.logger.error(`SendGrid connection test failed: ${error.message}`);
      return {
        success: false,
        message: 'SendGrid connection test failed',
        error: error.message
      };
    }
  }

  // 🎯 Slack 연결 테스트
  private async testSlackConnection(credentials: Record<string, string>) {
    try {
      const { webhook_url } = credentials;
      
      const response = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '🎯 Piehands CRM 연동 테스트가 성공했습니다!'
        })
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Slack connection successful!'
        };
      } else {
        throw new Error(`Webhook returned status ${response.status}`);
      }

    } catch (error) {
      this.logger.error(`Slack connection test failed: ${error.message}`);
      return {
        success: false,
        message: 'Slack connection failed',
        error: error.message
      };
    }
  }

  // 🎯 Mixpanel 연결 테스트 (간단 구현)
  private async testMixpanelConnection(credentials: Record<string, string>) {
    const { project_token } = credentials;
    
    if (!project_token) {
      return {
        success: false,
        message: 'Mixpanel project token is required'
      };
    }

    return {
      success: true,
      message: 'Mixpanel credentials saved (connection test not implemented yet)'
    };
  }

  // 🎯 Helper: 특정 설정 값 조회 (메모리 캐시에서)
  async getSetting(workspaceId: string, category: string, key: string): Promise<string | null> {
    this.logger.log(`Getting setting: ${category}.${key} for workspace ${workspaceId}`);
    
    const cacheKey = `${workspaceId}:${category}`;
    const categorySettings = this.settingsCache.get(cacheKey) || {};
    
    return categorySettings[key] || null;
  }

  // 🎯 Helper: SendGrid 설정 전체 조회 (메모리 캐시에서)
  async getSendGridSettings(workspaceId: string) {
    this.logger.log(`Getting SendGrid settings for workspace: ${workspaceId}`);
    
    const cacheKey = `${workspaceId}:sendgrid`;
    return this.settingsCache.get(cacheKey) || {};
  }
}
