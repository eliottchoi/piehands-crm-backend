import { Module, forwardRef } from '@nestjs/common';
import { CloudTasksService } from './cloud-tasks.service';
import { WarmupService } from './warmup.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SendGridModule } from '../sendgrid/sendgrid.module';
import { TemplatesModule } from '../templates/templates.module';
import { UsersModule } from '../users/users.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [
    PrismaModule,
    SendGridModule,
    TemplatesModule,
    UsersModule,
    forwardRef(() => CampaignsModule),
  ],
  controllers: [TasksController],
  providers: [CloudTasksService, WarmupService],
  exports: [CloudTasksService, WarmupService],
})
export class TasksModule {}