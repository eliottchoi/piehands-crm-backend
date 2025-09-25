import { Controller, Post, Body, Logger } from '@nestjs/common';
import { SendGridService } from '../sendgrid/sendgrid.service';
import { TemplatesService } from '../templates/templates.service';
import { UsersService } from '../users/users.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { WarmupService } from './warmup.service';
import { EmailTaskPayload, WarmupResetPayload } from './cloud-tasks.service';
import { Liquid } from 'liquidjs';

@Controller('tasks')
export class TasksController {
  private readonly logger = new Logger(TasksController.name);
  private readonly liquidEngine = new Liquid();

  constructor(
    private readonly sendGridService: SendGridService,
    private readonly templatesService: TemplatesService,
    private readonly usersService: UsersService,
    private readonly campaignsService: CampaignsService,
    private readonly warmupService: WarmupService,
  ) {}

  // 🎯 Cloud Tasks에서 호출되는 이메일 발송 엔드포인트
  @Post('send-email')
  async handleEmailTask(@Body() payload: EmailTaskPayload) {
    try {
      this.logger.log(`Processing email task for user ${payload.userId}`);

      // 1. Warm-up 제한 확인
      const canSend = await this.warmupService.checkDailyLimit(
        payload.workspaceId,
      );
      if (!canSend) {
        this.logger.warn(
          `Daily limit reached for workspace ${payload.workspaceId}`,
        );
        return { success: false, reason: 'daily_limit_reached' };
      }

      // 2. 사용자 정보 조회 (이메일이 payload에 없는 경우)
      let toEmail = payload.to;
      let user = null;

      if (!toEmail && payload.userId) {
        user = await this.usersService.findOneById(
          payload.workspaceId,
          payload.userId,
          10,
        );
        toEmail = user.properties?.email;

        if (!toEmail) {
          this.logger.error(`No email found for user ${payload.userId}`);
          return { success: false, reason: 'no_email' };
        }
      } else if (payload.userId) {
        // 템플릿 렌더링을 위해 사용자 정보가 필요한 경우
        user = await this.usersService.findOneById(
          payload.workspaceId,
          payload.userId,
          10,
        );
      }

      // 3. 템플릿 정보 조회 및 렌더링 (제목/내용이 payload에 없는 경우)
      let subject = payload.subject;
      let html = payload.html;

      if ((!subject || !html) && payload.templateId) {
        const template = await this.templatesService.findOne(
          payload.templateId,
        );
        const templateContent = template.content as any;

        // 🎯 Liquid 템플릿 렌더링 추가
        if (user) {
          const userProperties = (user.properties || {}) as Record<string, any>;
          const scope = {
            user: {
              id: user.id,
              distinctId: user.distinctId,
              emailStatus: user.emailStatus,
              name: userProperties.name || 'User',
              email: userProperties.email || '',
              ...userProperties,
            },
          };

          // 템플릿 렌더링
          subject =
            subject ||
            (await this.liquidEngine.parseAndRender(
              templateContent.subject || 'No Subject',
              scope,
            ));
          html =
            html ||
            (await this.liquidEngine.parseAndRender(
              templateContent.body_html ||
                templateContent.body_markdown ||
                templateContent.body_text ||
                templateContent.message ||
                '<p>No Content</p>',
              scope,
            ));
        } else {
          // 사용자 정보가 없는 경우 원본 템플릿 사용
          subject = subject || templateContent.subject || 'No Subject';
          html =
            html ||
            templateContent.body_html ||
            templateContent.body ||
            '<p>No Content</p>';
        }
      }

      // 4. 실제 이메일 발송
      const result = await this.sendGridService.sendEmail({
        to: toEmail,
        subject,
        html,
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        campaignId: payload.campaignId,
        templateId: payload.templateId,
      });

      // 5. Warm-up 카운터 증가
      if (result.success) {
        await this.warmupService.incrementDailyCount(payload.workspaceId);
      }

      this.logger.log(
        `Email task completed for ${toEmail}: ${result.success ? 'SUCCESS' : 'FAILED'}`,
      );
      return { success: result.success, messageId: result.messageId };
    } catch (error) {
      this.logger.error(`Email task failed: ${error.message}`);
      throw error; // Cloud Tasks가 재시도하도록 에러 전파
    }
  }

  // 🎯 Cloud Scheduler에서 호출되는 Warm-up 리셋 엔드포인트
  @Post('reset-warmup')
  async handleWarmupReset(@Body() payload: WarmupResetPayload) {
    try {
      this.logger.log(
        `Processing warmup reset for workspace ${payload.workspaceId} on ${payload.date}`,
      );

      // 특정 워크스페이스가 지정된 경우
      if (payload.workspaceId && payload.workspaceId !== 'all') {
        await this.warmupService.resetDailyCount(
          payload.workspaceId,
          payload.date,
        );
        this.logger.log(
          `Warmup reset completed for workspace ${payload.workspaceId}`,
        );
      } else {
        // 모든 워크스페이스에 대해 리셋 (Cloud Scheduler 일괄 처리)
        await this.warmupService.resetAllWorkspacesDaily(payload.date);
        this.logger.log(`Warmup reset completed for all workspaces`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Warmup reset failed: ${error.message}`);
      throw error;
    }
  }

  // 🎯 Cloud Tasks에서 호출되는 캠페인 노드 실행 엔드포인트 (미래 확장용)
  @Post('execute-node')
  async handleNodeExecution(
    @Body() payload: { userId: string; campaignId: string; nodeId: string },
  ) {
    try {
      this.logger.log(
        `Processing node execution: ${payload.nodeId} for user ${payload.userId}`,
      );

      // TODO: Canvas 기반 노드 실행 로직 구현
      // 현재는 이메일 발송만 지원

      return { success: true, message: 'Node execution not implemented yet' };
    } catch (error) {
      this.logger.error(`Node execution failed: ${error.message}`);
      throw error;
    }
  }
}
