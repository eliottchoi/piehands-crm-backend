import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import * as sgClient from '@sendgrid/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  SendGridMailData,
  SendGridResponse,
  EmailLogCreateData,
} from './types';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  userId: string;
  workspaceId: string; // 🎯 워크스페이스 설정을 읽기 위해 필요
  campaignId?: string;
  templateId?: string;
}

export interface SendResult {
  messageId: string;
  statusCode: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name);
  private readonly client: any;

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {
    this.client = sgClient;
    this.logger.log(
      'SendGrid service initialized (will load settings dynamically)',
    );
  }

  // 🎯 핵심: 안정적인 이메일 발송 (1만 크리에이터 대응)
  async sendEmail(params: SendEmailParams): Promise<SendResult> {
    const startTime = Date.now();

    try {
      // 🎯 워크스페이스 SendGrid 설정 조회
      const sendGridSettings = await this.settingsService.getSendGridSettings(
        params.workspaceId,
      );

      // 🎯 환경변수 우선 사용 (안정성을 위해)
      const apiKey = process.env.SENDGRID_API_KEY || sendGridSettings.api_key;
      const fromEmail =
        process.env.SENDGRID_FROM_EMAIL ||
        sendGridSettings.from_email ||
        'dxt@buffamin.com';
      const fromName =
        process.env.SENDGRID_FROM_NAME ||
        sendGridSettings.from_name ||
        'Piehands Team';

      // 🎯 디버깅: 설정 정보 로깅
      this.logger.log(
        `SendGrid Settings - API Key: ${apiKey ? 'SET' : 'MISSING'}, From: ${fromEmail}, Name: ${fromName}`,
      );
      this.logger.log(`Settings Cache: ${JSON.stringify(sendGridSettings)}`);

      if (!apiKey) {
        throw new BadRequestException(
          'SendGrid API key not configured. Please configure in Settings > Integrations.',
        );
      }

      // 🎯 동적 API 키 설정
      sgMail.setApiKey(apiKey);
      this.client.setApiKey(apiKey);

      // 이메일 유효성 기본 검증
      if (!this.isValidEmail(params.to)) {
        throw new BadRequestException(`Invalid email address: ${params.to}`);
      }

      // SendGrid 메시지 구성
      const msg = {
        to: params.to,
        from: {
          email: fromEmail,
          name: fromName,
        },
        subject: params.subject,
        html: params.html,

        // 🎯 추적을 위한 메타데이터
        customArgs: {
          piehands_user_id: params.userId,
          piehands_campaign_id: params.campaignId || '',
          piehands_template_id: params.templateId || '',
          piehands_timestamp: new Date().toISOString(),
        },

        // 🎯 필수 추적 설정
        trackingSettings: {
          clickTracking: { enable: true, enableText: true },
          openTracking: { enable: true },
          subscriptionTracking: {
            enable: true,
            text: 'To unsubscribe, click here',
            html: '<a href="%unsubscribe_url%">Unsubscribe</a>',
          },
        },

        // 🎯 Deliverability 최적화 (spam check 비활성화 - post_to_url 필수 때문에)
        mailSettings: {
          spamCheck: { enable: false },
        },
      };

      // 🎯 디버깅: 메시지 구조 로깅
      this.logger.log(
        `Sending email with message: ${JSON.stringify(msg, null, 2)}`,
      );

      // SendGrid 발송
      const response = await sgMail.send(msg);
      const messageId = response[0]?.headers?.['x-message-id'] || '';

      const result: SendResult = {
        messageId,
        statusCode: response[0]?.statusCode || 0,
        timestamp: new Date(),
        success: true,
      };

      // 🎯 이메일 로그 기록 (완전한 추적)
      await this.logEmailSend(params, result);

      // 🎯 User Event 기록 (CRM 히스토리)
      await this.createUserEmailEvent(params, 'email_sent', {
        messageId,
        subject: params.subject,
        campaign_id: params.campaignId,
        template_id: params.templateId,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Email sent successfully to ${params.to} in ${duration}ms - MessageID: ${messageId}`,
      );

      return result;
    } catch (error) {
      const result: SendResult = {
        messageId: '',
        statusCode: 0,
        timestamp: new Date(),
        success: false,
        error: error.message,
      };

      // 실패도 로깅
      await this.logEmailSend(params, result);

      const duration = Date.now() - startTime;

      // 🎯 SendGrid 상세 에러 정보 로깅
      this.logger.error(
        `Email send failed to ${params.to} in ${duration}ms: ${error.message}`,
      );
      if (error.response && error.response.body) {
        this.logger.error(
          `SendGrid API Error Details: ${JSON.stringify(error.response.body)}`,
        );
      }

      throw error;
    }
  }

  // 🎯 이메일 로그 기록 (완전한 추적)
  private async logEmailSend(params: SendEmailParams, result: SendResult) {
    try {
      await this.prisma.emailLog.create({
        data: {
          userId: params.userId,
          campaignId: params.campaignId,
          templateId: params.templateId,
          sendgridMessageId: result.messageId,
          toEmail: params.to,
          subject: params.subject,
          status: result.success ? 'sent' : 'failed',
          errorMessage: result.error,
          sentAt: result.timestamp,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log email send: ${error.message}`);
    }
  }

  // 🎯 User Event 기록 (CRM 히스토리)
  private async createUserEmailEvent(
    params: SendEmailParams,
    eventName: string,
    eventProperties: any,
  ) {
    try {
      await this.prisma.event.create({
        data: {
          userId: params.userId,
          name: eventName,
          properties: eventProperties,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create user event: ${error.message}`);
    }
  }

  // 🎯 기본 이메일 유효성 검증
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // 🎯 SendGrid API Health Check
  async healthCheck(): Promise<boolean> {
    try {
      const request = {
        url: '/v3/user/profile',
        method: 'GET' as const,
      };

      const [response] = await this.client.request(request);
      return response.statusCode === 200;
    } catch (error) {
      this.logger.error(`SendGrid health check failed: ${error.message}`);
      return false;
    }
  }

  // 🎯 Rate Limit 상태 확인
  async getRateLimitStatus() {
    try {
      const request = {
        url: '/v3/user/credits',
        method: 'GET' as const,
      };

      const [response, body] = await this.client.request(request);
      return body;
    } catch (error) {
      this.logger.error(`Failed to get rate limit status: ${error.message}`);
      return null;
    }
  }
}
