import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendGridEvent } from '../sendgrid/types';

@Injectable()
export class SendGridWebhookService {
  private readonly logger = new Logger(SendGridWebhookService.name);

  constructor(private prisma: PrismaService) {}

  // 🎯 핵심: SendGrid 이벤트 배치 처리
  async processEvents(events: SendGridEvent[]): Promise<void> {
    this.logger.log(`Processing ${events.length} SendGrid events`);

    for (const event of events) {
      try {
        await this.processEvent(event);
      } catch (error) {
        this.logger.error(
          `Failed to process event ${event.sg_event_id || event.sg_message_id}: ${error.message}`,
        );
        // 하나의 이벤트 실패가 전체를 망치지 않도록 계속 진행
      }
    }

    this.logger.log(`Completed processing ${events.length} events`);
  }

  // 🎯 개별 이벤트 처리
  private async processEvent(event: SendGridEvent): Promise<void> {
    const { email, timestamp, sg_message_id } = event;

    // 1. 이메일로 사용자 찾기
    const user = await this.findUserByEmail(email);
    if (!user) {
      this.logger.warn(`User not found for email: ${email}`);
      return;
    }

    // 2. 이벤트 타입별 처리
    switch (event.event) {
      case 'delivered':
        await this.handleDeliveredEvent(event, user);
        break;
      case 'opened':
        await this.handleOpenedEvent(event, user);
        break;
      case 'clicked':
        await this.handleClickedEvent(event, user);
        break;
      case 'bounce':
        await this.handleBounceEvent(event, user);
        break;
      case 'unsubscribe':
        await this.handleUnsubscribeEvent(event, user);
        break;
      case 'spam_report':
        await this.handleSpamReportEvent(event, user);
        break;
      default:
        this.logger.log(`Unknown event type: ${event.event}`);
    }
  }

  // 🎯 이메일 전달 완료 처리
  private async handleDeliveredEvent(event: SendGridEvent, user: any) {
    await Promise.all([
      // Email Log 업데이트
      this.updateEmailLog(event.sg_message_id, {
        status: 'delivered',
        deliveredAt: new Date(event.timestamp * 1000),
      }),

      // User Event 추가 (CRM 히스토리)
      this.createUserEvent(user.id, 'email_delivered', {
        messageId: event.sg_message_id,
        email: event.email,
        timestamp: new Date(event.timestamp * 1000),
      }),
    ]);
  }

  // 🎯 이메일 오픈 처리
  private async handleOpenedEvent(event: SendGridEvent, user: any) {
    await Promise.all([
      // Email Log 업데이트
      this.updateEmailLog(event.sg_message_id, {
        status: 'opened',
        openedAt: new Date(event.timestamp * 1000),
        userAgent: event.useragent,
        ipAddress: event.ip,
      }),

      // User Event 추가
      this.createUserEvent(user.id, 'email_opened', {
        messageId: event.sg_message_id,
        userAgent: event.useragent,
        ipAddress: event.ip,
        timestamp: new Date(event.timestamp * 1000),
      }),
    ]);
  }

  // 🎯 이메일 클릭 처리
  private async handleClickedEvent(event: SendGridEvent, user: any) {
    await Promise.all([
      // Email Log 업데이트
      this.updateEmailLog(event.sg_message_id, {
        status: 'clicked',
        clickedAt: new Date(event.timestamp * 1000),
        clickedUrl: event.url,
        userAgent: event.useragent,
        ipAddress: event.ip,
      }),

      // User Event 추가
      this.createUserEvent(user.id, 'email_clicked', {
        messageId: event.sg_message_id,
        clickedUrl: event.url,
        userAgent: event.useragent,
        ipAddress: event.ip,
        timestamp: new Date(event.timestamp * 1000),
      }),
    ]);
  }

  // 🎯 이메일 반송 처리 (deliverability 핵심)
  private async handleBounceEvent(event: SendGridEvent, user: any) {
    await Promise.all([
      // Email Log 업데이트
      this.updateEmailLog(event.sg_message_id, {
        status: 'bounced',
        bouncedAt: new Date(event.timestamp * 1000),
        bounceReason: event.reason,
        bounceType: event.type,
      }),

      // User email_status 업데이트 (중요!)
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailStatus: 'bounced' },
      }),

      // User Event 추가
      this.createUserEvent(user.id, 'email_bounced', {
        messageId: event.sg_message_id,
        reason: event.reason,
        bounceType: event.type,
        timestamp: new Date(event.timestamp * 1000),
      }),
    ]);

    this.logger.warn(`Email bounced for user ${user.id}: ${event.reason}`);
  }

  // 🎯 수신 거부 처리 (법적 준수 핵심)
  private async handleUnsubscribeEvent(event: SendGridEvent, user: any) {
    await Promise.all([
      // Email Log 업데이트
      this.updateEmailLog(event.sg_message_id, {
        status: 'unsubscribed',
        unsubscribedAt: new Date(event.timestamp * 1000),
      }),

      // User email_status 업데이트 (중요!)
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailStatus: 'unsubscribed' },
      }),

      // User Event 추가
      this.createUserEvent(user.id, 'email_unsubscribed', {
        messageId: event.sg_message_id,
        email: event.email,
        timestamp: new Date(event.timestamp * 1000),
      }),
    ]);

    this.logger.log(`User ${user.id} unsubscribed via email ${event.email}`);
  }

  // 🎯 스팸 신고 처리 (reputation 보호)
  private async handleSpamReportEvent(event: SendGridEvent, user: any) {
    await Promise.all([
      // User email_status 업데이트 (스팸 신고는 unsubscribe와 동일 처리)
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailStatus: 'unsubscribed' },
      }),

      // User Event 추가
      this.createUserEvent(user.id, 'email_spam_report', {
        messageId: event.sg_message_id,
        email: event.email,
        timestamp: new Date(event.timestamp * 1000),
      }),
    ]);

    this.logger.warn(
      `Spam report received for user ${user.id}: ${event.email}`,
    );
  }

  // 🎯 Helper: 이메일로 사용자 찾기
  private async findUserByEmail(email: string) {
    return await this.prisma.user.findFirst({
      where: {
        properties: {
          path: ['email'],
          equals: email,
        },
      },
    });
  }

  // 🎯 Helper: Email Log 업데이트
  private async updateEmailLog(messageId: string, updateData: any) {
    if (!messageId) return;

    try {
      return await this.prisma.emailLog.updateMany({
        where: { sendgridMessageId: messageId },
        data: updateData,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update email log for ${messageId}: ${error.message}`,
      );
    }
  }

  // 🎯 Helper: User Event 생성 (CRM 히스토리)
  private async createUserEvent(
    userId: string,
    eventName: string,
    properties: any,
  ) {
    try {
      return await this.prisma.event.create({
        data: {
          userId,
          name: eventName,
          properties,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create user event: ${error.message}`);
    }
  }
}
