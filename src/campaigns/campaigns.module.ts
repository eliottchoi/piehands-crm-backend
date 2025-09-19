import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SendGridModule } from '../sendgrid/sendgrid.module';
import { TemplatesModule } from '../templates/templates.module';
@Module({
  imports: [PrismaModule, SendGridModule, TemplatesModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService]
})
export class CampaignsModule {}
