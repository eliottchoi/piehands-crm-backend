import { Module, forwardRef } from '@nestjs/common';
import { SendGridService } from './sendgrid.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, forwardRef(() => SettingsModule)],
  providers: [SendGridService],
  exports: [SendGridService],
})
export class SendGridModule {}
