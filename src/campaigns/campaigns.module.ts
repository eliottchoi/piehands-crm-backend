import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PrismaModule } from '../prisma/prisma.module';
// TODO: SendGrid 연동 후 활성화
// import { SendGridModule } from '../sendgrid/sendgrid.module';
// import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [PrismaModule], // TODO: SendGridModule, TemplatesModule 나중에 추가
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService]
})
export class CampaignsModule {}
