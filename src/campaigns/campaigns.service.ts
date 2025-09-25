import {
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendCampaignDto, TargetUserGroup } from './dto/send-campaign.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Campaign, User, Template } from '@prisma/client';
import { TemplatesService } from '../templates/templates.service';
import { SendGridService } from '../sendgrid/sendgrid.service';
import { Liquid } from 'liquidjs';
import { CampaignJobService } from './campaign-job.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  private readonly liquidEngine = new Liquid();

  constructor(
    private prisma: PrismaService,
    private sendGridService: SendGridService,
    private templatesService: TemplatesService,
    @Inject(forwardRef(() => CampaignJobService))
    private campaignJobService: CampaignJobService,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  // 🎯 이메일 노드의 타겟 설정에 따라 사용자 목록 조회
  private async getTargetUsers(
    workspaceId: string,
    targetConfig: any,
  ): Promise<User[]> {
    if (!targetConfig || !targetConfig.type) {
      // 기본값: 모든 활성 사용자
      return this.prisma.user.findMany({
        where: {
          workspaceId,
          emailStatus: 'active',
        },
      });
    }

    switch (targetConfig.type) {
      case 'ALL_USERS':
        return this.prisma.user.findMany({
          where: {
            workspaceId,
            emailStatus: 'active',
          },
        });

      case 'SPECIFIC_USERS':
        if (!targetConfig.userIds || !Array.isArray(targetConfig.userIds)) {
          this.logger.warn(
            'SPECIFIC_USERS target config missing userIds array',
          );
          return [];
        }
        return this.prisma.user.findMany({
          where: {
            workspaceId,
            id: { in: targetConfig.userIds },
            emailStatus: 'active',
          },
        });

      case 'BY_FILTER':
        // 향후 확장: 동적 필터링 로직
        if (targetConfig.filter) {
          // TODO: 복잡한 필터링 로직 구현 (category, follower_count 등)
          this.logger.log(
            'BY_FILTER targeting not yet implemented, falling back to ALL_USERS',
          );
        }
        return this.prisma.user.findMany({
          where: {
            workspaceId,
            emailStatus: 'active',
          },
        });

      default:
        this.logger.warn(
          `Unknown target type: ${targetConfig.type}, falling back to ALL_USERS`,
        );
        return this.prisma.user.findMany({
          where: {
            workspaceId,
            emailStatus: 'active',
          },
        });
    }
  }

  findAll(workspaceId: string) {
    return this.prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  create(createCampaignDto: CreateCampaignDto, workspaceId: string) {
    return this.prisma.campaign.create({
      data: {
        ...createCampaignDto,
        workspaceId,
        status: 'DRAFT',
      },
    });
  }

  update(id: string, updateCampaignDto: UpdateCampaignDto) {
    return this.prisma.campaign.update({
      where: { id },
      data: updateCampaignDto,
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found.`);
    }
    return campaign;
  }

  async getCampaignStatus(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found.`);
    }

    // This is a simplified version. For large campaigns, we need a better way to get total users.
    // For now, let's assume we can query the users again or we stored the count somewhere.
    const emailSendNode = (campaign.canvasDefinition as any)?.nodes?.find(
      (node) => node.type === 'EMAIL_SEND',
    );
    const totalUsers = await this.getTargetUsers(
      campaign.workspaceId,
      emailSendNode?.data?.targetConfig,
    );
    const totalUserCount = totalUsers.length;

    const processedCount = await this.prisma.emailLog.count({
      where: { campaignId: id },
    });

    const progress =
      totalUserCount > 0 ? (processedCount / totalUserCount) * 100 : 0;

    return {
      campaignId: id,
      status: campaign.status,
      totalUsers: totalUserCount,
      processedUsers: processedCount,
      progress: progress.toFixed(2),
    };
  }

  async activate(id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found.`);
    }

    // Update campaign status to SENDING
    const updatedCampaign = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'SENDING' },
    });

    const canvasDef = updatedCampaign.canvasDefinition as any;
    const immediateTrigger = canvasDef?.nodes?.find(
      (node) => node.type === 'IMMEDIATE',
    );
    const emailSendNode = canvasDef?.nodes?.find(
      (node) => node.type === 'EMAIL_SEND',
    );

    if (immediateTrigger && emailSendNode) {
      // Find users based on EMAIL_SEND node's target configuration
      const users = await this.getTargetUsers(
        campaign.workspaceId,
        emailSendNode.data?.targetConfig,
      );

      if (users.length > 0) {
        // Start the campaign for these users in the background
        this.triggerCampaignForUsers(updatedCampaign, users);
      } else {
        this.logger.warn(`No target users found for campaign ${id}`);
      }
    } else {
      this.logger.warn(
        `Campaign ${id} missing IMMEDIATE trigger or EMAIL_SEND node`,
      );
    }

    return updatedCampaign;
  }

  async triggerCampaignForUsers(campaign: Campaign, users: User[]) {
    this.logger.log(
      `Triggering campaign ${campaign.id} for ${users.length} users.`,
    );

    // 캔버스에서 EMAIL_SEND 노드와 템플릿 정보 추출
    const canvasDef = campaign.canvasDefinition as any;
    const emailSendNode = canvasDef?.nodes?.find(
      (node: any) => node.type === 'EMAIL_SEND',
    );

    if (!emailSendNode || !emailSendNode.data?.templateId) {
      this.logger.error(
        `Campaign ${campaign.id} missing EMAIL_SEND node or templateId`,
      );
      return;
    }

    // Cloud Tasks를 통한 이메일 발송 시작
    try {
      const jobConfig = {
        campaignId: campaign.id,
        workspaceId: campaign.workspaceId,
        templateId: emailSendNode.data.templateId,
        enableWarmup: true, // IP Warm-up 활성화
        userFilter: { id: { in: users.map((u) => u.id) } }, // 🎯 타겟 사용자만 필터링
      };

      const jobId = await this.campaignJobService.startCampaignJob(jobConfig);
      this.logger.log(
        `Started campaign job ${jobId} for campaign ${campaign.id}`,
      );

      // 캠페인 상태를 SENDING으로 유지 (CampaignJobService가 관리)
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'SENDING',
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to start campaign job for ${campaign.id}: ${error.message}`,
      );

      // 실패 시 상태를 FAILED로 변경
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED' },
      });
    }
  }

  async sendManualCampaign(
    workspaceId: string,
    sendCampaignDto: SendCampaignDto,
  ) {
    const { templateId, targetGroup } = sendCampaignDto;

    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found.`);
    }

    let usersToProcess = [];
    if (targetGroup === TargetUserGroup.ALL_USERS) {
      usersToProcess = await this.prisma.user.findMany({
        where: {
          workspaceId,
          emailStatus: 'active', // Only send to active users
        },
      });
    } else {
      // Handle other target groups in the future
      throw new Error('Unsupported target group');
    }

    if (usersToProcess.length === 0) {
      return { message: 'No active users to send the campaign to.', count: 0 };
    }

    this.logger.log(
      `🚀 Starting manual campaign send: ${usersToProcess.length} users`,
    );

    // 🎯 실제 SendGrid 발송 활성화!
    try {
      await this.processBulkEmailSend(template, usersToProcess, null);

      return {
        message: `Campaign sending completed for ${usersToProcess.length} users. Check email logs for results.`,
        count: usersToProcess.length,
      };
    } catch (error) {
      this.logger.error(`❌ Campaign sending failed: ${error.message}`);
      throw new Error(`Campaign sending failed: ${error.message}`);
    }
  }

  // 🎯 SendGrid 연동 활성화! (Mission-Critical Email Sending)
  // 🎯 대량 이메일 발송 처리 (1만 크리에이터 대응)
  private async processBulkEmailSend(
    template: Template,
    users: User[],
    campaignId: string | null = null,
  ) {
    this.logger.log(`📧 Processing bulk email send for ${users.length} users`);

    let successCount = 0;
    let failureCount = 0;

    // 🎯 Rate limiting: 초당 최대 10개씩 처리 (SendGrid 제한 준수)
    const BATCH_SIZE = 10;
    const DELAY_MS = 1000; // 1초 대기

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (user) => {
          try {
            await this.sendEmailWithRetry(user, template, campaignId);
            successCount++;
            this.logger.debug(`✅ Email sent to ${user.distinctId || user.id}`);
          } catch (error) {
            failureCount++;
            this.logger.error(
              `❌ 최종 실패: ${user.distinctId || user.id} - ${error.message}`,
            );
          }
        }),
      );

      // 다음 배치 전 대기 (Rate limiting)
      if (i + BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }

      // 진행 상황 로깅
      this.logger.log(
        `📊 Progress: ${Math.min(i + BATCH_SIZE, users.length)}/${users.length} processed`,
      );
    }

    this.logger.log(
      `🎉 Bulk send completed: ${successCount} success, ${failureCount} failed`,
    );
  }

  // 🎯 실패 시 재시도 로직 추가 (Exponential Backoff)
  private async sendEmailWithRetry(
    user: User,
    template: Template,
    campaignId: string | null,
    maxRetries = 3,
  ) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        await this.sendEmailToUser(user, template, campaignId);
        return; // 성공 시 함수 종료
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error; // 모든 재시도 실패 시 에러 발생
        }
        const delay = Math.pow(3, attempt - 1) * 1000; // 1초, 3초, 9초...
        this.logger.warn(
          `Attempt ${attempt} failed for ${user.id}. Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // 🎯 개별 사용자에게 이메일 발송
  private async sendEmailToUser(
    user: User,
    template: Template,
    campaignId: string | null = null,
  ) {
    // 1. 이메일 주소 검증
    const userEmail = (user.properties as any)?.email;
    if (
      !userEmail ||
      typeof userEmail !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)
    ) {
      throw new Error(
        `User ${user.id} has an invalid email address: ${userEmail}`,
      );
    }

    // 2. 템플릿 렌더링 (사용자 데이터와 조합)
    const renderedContent = await this.renderTemplate(template, user);

    // 3. SendGrid로 실제 발송
    await this.sendGridService.sendEmail({
      to: userEmail,
      subject: renderedContent.subject,
      html: renderedContent.html,
      userId: user.id,
      workspaceId: user.workspaceId, // 🎯 워크스페이스 설정을 위해 추가
      campaignId,
      templateId: template.id,
    });
  }

  // 🎯 템플릿 렌더링 (LiquidJS)
  private async renderTemplate(template: Template, user: User) {
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

    const content = template.content as any;

    return {
      subject: await this.liquidEngine.parseAndRender(
        content.subject || '',
        scope,
      ),
      html: await this.liquidEngine.parseAndRender(
        content.body_html ||
          content.body_markdown ||
          content.body_text ||
          content.message ||
          '',
        scope,
      ),
    };
  }
}
