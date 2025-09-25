import { Module, forwardRef } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignJobController } from './campaign-job.controller';
import { CampaignJobService } from './campaign-job.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SendGridModule } from '../sendgrid/sendgrid.module';
import { TemplatesModule } from '../templates/templates.module';
import { SettingsModule } from '../settings/settings.module';
import { TasksModule } from '../tasks/tasks.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    SendGridModule,
    TemplatesModule,
    SettingsModule,
    forwardRef(() => TasksModule),
  ],
  controllers: [CampaignsController, CampaignJobController],
  providers: [CampaignsService, CampaignJobService],
  exports: [CampaignsService, CampaignJobService],
})
export class CampaignsModule {}
