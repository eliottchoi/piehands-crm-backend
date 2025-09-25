import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TemplatesModule } from './templates/templates.module';
import { UsersModule } from './users/users.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { FirebaseModule } from './firebase/firebase.module';
import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SendGridModule } from './sendgrid/sendgrid.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SettingsModule } from './settings/settings.module';
import { EventsModule } from './events/events.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    FirebaseModule,
    TemplatesModule,
    UsersModule,
    CampaignsModule,
    HealthModule, // 🎯 Health Check
    AnalyticsModule, // 🎯 이메일 분석 & 로그 조회
    SettingsModule, // 🎯 워크스페이스 설정 관리
    SendGridModule, // 🎯 SendGrid 이메일 발송 (활성화!)
    WebhooksModule, // 🎯 SendGrid 웹훅 수신 (활성화!)
    EventsModule, WorkspacesModule, AuthModule, // 🎯 사용자 이벤트 수집 (활성화!)
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard('jwt'),
    },
  ],
})
export class AppModule {}
