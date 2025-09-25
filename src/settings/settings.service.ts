import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto, TestConnectionDto } from './dto/settings.dto';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly secretClient = new SecretManagerServiceClient();

  constructor(private prisma: PrismaService) {
    this.initializeDefaultSettings();
  }

  // 🎯 기본 설정 초기화
  private initializeDefaultSettings() {
    // ws_piehands 워크스페이스에 기본 SendGrid 설정 추가
    const defaultSendGridSettings = {
      api_key: process.env.SENDGRID_API_KEY || '',
      from_email: process.env.SENDGRID_FROM_EMAIL || 'dxt@buffamin.com',
      from_name: process.env.SENDGRID_FROM_NAME || 'Piehands Team',
      tracking_enabled: true,
      unsubscribe_enabled: true,
    };

    this.settingsCache.set('ws_piehands:sendgrid', defaultSendGridSettings);
    this.logger.log('✅ Default SendGrid settings initialized for ws_piehands');
  }

  // 🎯 워크스페이스 설정 조회 (메모리 캐시에서)
  async getWorkspaceSettings(workspaceId: string) {
    this.logger.log(`Getting settings for workspace: ${workspaceId}`);

    // 💾 메모리 캐시에서 조회
    const sendgridSettings =
      this.settingsCache.get(`${workspaceId}:sendgrid`) || {};
    const slackSettings = this.settingsCache.get(`${workspaceId}:slack`) || {};
    const mixpanelSettings =
      this.settingsCache.get(`${workspaceId}:mixpanel`) || {};

    return {
      sendgrid: sendgridSettings,
      slack: slackSettings,
      mixpanel: mixpanelSettings,
    };
  }

  // 🎯 설정 업데이트 (메모리 + Secret Manager)
  private settingsCache = new Map<string, Record<string, any>>();

  async updateSettings(dto: UpdateSettingsDto) {
    const { workspaceId, category, settings } = dto;

    this.logger.log(
      `Updating ${category} settings for workspace ${workspaceId}`,
    );

    // 💾 메모리에 저장
    const cacheKey = `${workspaceId}:${category}`;
    this.settingsCache.set(cacheKey, settings);

    // 🔐 Secret Manager에 저장 (SendGrid 설정인 경우)
    if (category === 'sendgrid') {
      await this.saveToSecretManager(workspaceId, settings);
    }

    this.logger.log(
      `Successfully saved ${Object.keys(settings).length} ${category} settings`,
    );

    return {
      message: `${category} settings saved successfully`,
      count: Object.keys(settings).length,
    };
  }

  // 🔐 Secret Manager에 설정 저장
  private async saveToSecretManager(
    workspaceId: string,
    settings: Record<string, any>,
  ) {
    try {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'piehands-agents';

      // SendGrid API Key 저장
      if (settings.api_key) {
        await this.createOrUpdateSecret(
          `${projectId}`,
          `crm-${workspaceId}-sendgrid-api-key`,
          settings.api_key,
        );
      }

      // SendGrid From Email 저장
      if (settings.from_email) {
        await this.createOrUpdateSecret(
          `${projectId}`,
          `crm-${workspaceId}-sendgrid-from-email`,
          settings.from_email,
        );
      }

      // SendGrid From Name 저장
      if (settings.from_name) {
        await this.createOrUpdateSecret(
          `${projectId}`,
          `crm-${workspaceId}-sendgrid-from-name`,
          settings.from_name,
        );
      }

      this.logger.log(
        `✅ SendGrid settings saved to Secret Manager for workspace ${workspaceId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to save to Secret Manager: ${error.message}`,
      );
      // Secret Manager 실패해도 메모리 저장은 유지
    }
  }

  // 🔐 Secret 생성 또는 업데이트
  private async createOrUpdateSecret(
    projectId: string,
    secretId: string,
    secretValue: string,
  ) {
    const secretName = `projects/${projectId}/secrets/${secretId}`;

    try {
      // 시크릿 존재 확인
      await this.secretClient.getSecret({ name: secretName });

      // 기존 시크릿에 새 버전 추가
      await this.secretClient.addSecretVersion({
        parent: secretName,
        payload: {
          data: Buffer.from(secretValue, 'utf8'),
        },
      });

      this.logger.log(`Updated secret: ${secretId}`);
    } catch (error) {
      if (error.code === 5) {
        // NOT_FOUND
        // 시크릿이 없으면 생성
        await this.secretClient.createSecret({
          parent: `projects/${projectId}`,
          secretId,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });

        // 첫 번째 버전 추가
        await this.secretClient.addSecretVersion({
          parent: secretName,
          payload: {
            data: Buffer.from(secretValue, 'utf8'),
          },
        });

        this.logger.log(`Created secret: ${secretId}`);
      } else {
        throw error;
      }
    }
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
          message: 'Invalid SendGrid API key format. Must start with "SG."',
        };
      }

      if (api_key.length < 50) {
        return {
          success: false,
          message: 'SendGrid API key appears too short',
        };
      }

      // TODO: 실제 SendGrid API 테스트 (순환 의존성 해결 후)
      return {
        success: true,
        message:
          'SendGrid API key format is valid! (Connection test will be implemented)',
        details: { keyLength: api_key.length },
      };
    } catch (error) {
      this.logger.error(`SendGrid connection test failed: ${error.message}`);
      return {
        success: false,
        message: 'SendGrid connection test failed',
        error: error.message,
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
          text: '🎯 Piehands CRM 연동 테스트가 성공했습니다!',
        }),
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Slack connection successful!',
        };
      } else {
        throw new Error(`Webhook returned status ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Slack connection test failed: ${error.message}`);
      return {
        success: false,
        message: 'Slack connection failed',
        error: error.message,
      };
    }
  }

  // 🎯 Mixpanel 연결 테스트 (간단 구현)
  private async testMixpanelConnection(credentials: Record<string, string>) {
    const { project_token } = credentials;

    if (!project_token) {
      return {
        success: false,
        message: 'Mixpanel project token is required',
      };
    }

    return {
      success: true,
      message:
        'Mixpanel credentials saved (connection test not implemented yet)',
    };
  }

  // 🎯 Helper: 특정 설정 값 조회 (메모리 캐시에서)
  async getSetting(
    workspaceId: string,
    category: string,
    key: string,
  ): Promise<string | null> {
    this.logger.log(
      `Getting setting: ${category}.${key} for workspace ${workspaceId}`,
    );

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
