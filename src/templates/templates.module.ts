import { Module, forwardRef } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { SendGridModule } from '../sendgrid/sendgrid.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    SendGridModule,
    SettingsModule,
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService], // 🎯 CampaignsService에서 사용하기 위해 export
})
export class TemplatesModule {}
