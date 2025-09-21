import { Module, forwardRef } from '@nestjs/common';
import { SendGridService } from './sendgrid.service';
import { SendGridStatsService } from './sendgrid-stats.service';
import { SendGridStatsController } from './sendgrid-stats.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, forwardRef(() => SettingsModule)],
  controllers: [SendGridStatsController],
  providers: [SendGridService, SendGridStatsService],
  exports: [SendGridService, SendGridStatsService],
})
export class SendGridModule {}
