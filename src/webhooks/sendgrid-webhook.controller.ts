import { Controller, Post, Body, Req, Logger, UnauthorizedException } from '@nestjs/common';
import { SendGridEvent } from '../sendgrid/types';
import { Request } from 'express';
import { SendGridWebhookService } from '../webhooks/sendgrid-webhook.service';

@Controller('webhooks')
export class SendGridWebhookController {
  private readonly logger = new Logger(SendGridWebhookController.name);

  constructor(private readonly webhookService: SendGridWebhookService) {}

  @Post('sendgrid')
  async handleSendGridWebhook(@Req() req: Request, @Body() events: SendGridEvent[]) {
    try {
      // 🎯 1. SendGrid 시그니처 검증 (보안 필수)
      const isValid = this.verifyWebhookSignature(req);
      if (!isValid) {
        this.logger.warn('Invalid SendGrid webhook signature received');
        throw new UnauthorizedException('Invalid webhook signature');
      }

      this.logger.log(`Received ${events.length} SendGrid events`);

      // 🎯 2. 즉시 응답 (SendGrid 요구사항)
      // 비동기 처리를 위해 setTimeout 사용
      setTimeout(() => {
        this.webhookService.processEvents(events).catch(error => {
          this.logger.error(`Failed to process SendGrid events: ${error.message}`);
        });
      }, 0);

      return { status: 'accepted', count: events.length };

    } catch (error) {
      this.logger.error(`SendGrid webhook error: ${error.message}`);
      throw error;
    }
  }

  // 🎯 SendGrid 웹훅 시그니처 검증 (스팸 방지 핵심)
  private verifyWebhookSignature(req: Request): boolean {
    try {
      const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
      const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
      
      if (!signature || !timestamp) {
        return false;
      }

      // TODO: 실제 프로덕션에서는 SENDGRID_WEBHOOK_SECRET로 HMAC 검증
      // const expectedSignature = crypto
      //   .createHmac('sha256', process.env.SENDGRID_WEBHOOK_SECRET)
      //   .update(timestamp + JSON.stringify(req.body))
      //   .digest('base64');
      // return signature === expectedSignature;

      // 개발 환경에서는 true 반환 (프로덕션에서는 실제 검증 필요)
      return true;
    } catch (error) {
      this.logger.error(`Signature verification failed: ${error.message}`);
      return false;
    }
  }
}
