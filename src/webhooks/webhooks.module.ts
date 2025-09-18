import { Module } from '@nestjs/common';
import { SendGridWebhookController } from './sendgrid-webhook.controller';
import { SendGridWebhookService } from './sendgrid-webhook.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SendGridWebhookController],
  providers: [SendGridWebhookService],
  exports: [SendGridWebhookService],
})
export class WebhooksModule {}
