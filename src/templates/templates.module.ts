import { Module, forwardRef } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { SendGridModule } from '../sendgrid/sendgrid.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    SendGridModule,
    SettingsModule,
    forwardRef(() => TasksModule),
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
