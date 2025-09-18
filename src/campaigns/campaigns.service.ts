import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendCampaignDto, TargetUserGroup } from './dto/send-campaign.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Campaign, User } from '@prisma/client';
// TODO: SendGrid 연동 후 활성화
// import { SendGridService } from '../sendgrid/sendgrid.service';
// import { TemplatesService } from '../templates/templates.service';
// import { Template } from '@prisma/client';
// import { Liquid } from 'liquidjs';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    // TODO: SendGrid와 Templates 의존성은 나중에 추가
    // private sendGridService: SendGridService,
    // private templatesService: TemplatesService,
  ) {}

  findAll(workspaceId: string) {
    return this.prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: {
        updatedAt: 'desc',
      }
    });
  }

  create(createCampaignDto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        ...createCampaignDto,
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
    const immediateTrigger = canvasDef?.nodes?.find(node => node.type === 'IMMEDIATE');

    if (immediateTrigger) {
      // Find users based on the trigger's target audience
      const users = await this.prisma.user.findMany({
        where: {
          workspaceId: campaign.workspaceId,
          emailStatus: 'active',
        },
      });
      // Start the campaign for these users in the background
      this.triggerCampaignForUsers(updatedCampaign, users);
    }
    
    return updatedCampaign;
  }

  async triggerCampaignForUsers(campaign: Campaign, users: User[]) {
    // This is where we create enrollments and queue the first action
    // For now, we will just log it. This logic will be expanded in later tasks.
    console.log(`Triggering campaign ${campaign.id} for ${users.length} users.`);
    
    const enrollments = users.map(user => ({
        userId: user.id,
        campaignId: campaign.id,
        status: 'ACTIVE',
        // TODO: Determine the first node from canvasDefinition
        currentNodeId: (campaign.canvasDefinition as any)?.nodes?.[0]?.id || null,
    }));
    
    // In a real scenario, this would be a more robust batch creation.
    // This is a simplified version for now.
    console.log('Creating enrollments:', enrollments);
  }

  async sendManualCampaign(workspaceId: string, sendCampaignDto: SendCampaignDto) {
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

    this.logger.log(`🚀 Starting manual campaign send: ${usersToProcess.length} users`);
    
    // 🎯 임시: SendGrid 연동 전까지는 시뮬레이션
    this.logger.log(`📧 Simulating email send to ${usersToProcess.length} users`);
    console.log(`[SIMULATION] Would send template ${templateId} to users:`, 
      usersToProcess.map(u => ({ id: u.id, email: (u.properties as any)?.email }))
    );

    return {
      message: `Campaign sending started for ${usersToProcess.length} users. Check email logs for progress.`,
      count: usersToProcess.length,
    };
  }

  // TODO: SendGrid 연동 후 활성화할 메서드들
  /*
  // 🎯 대량 이메일 발송 처리 (1만 크리에이터 대응)
  private async processBulkEmailSend(template: Template, users: User[], campaignId: string | null = null) {
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
            await this.sendEmailToUser(user, template, campaignId);
            successCount++;
            this.logger.debug(`✅ Email sent to ${user.distinctId || user.id}`);
          } catch (error) {
            failureCount++;
            this.logger.error(`❌ Failed to send email to ${user.distinctId || user.id}: ${error.message}`);
          }
        })
      );

      // 다음 배치 전 대기 (Rate limiting)
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }

      // 진행 상황 로깅
      this.logger.log(`📊 Progress: ${Math.min(i + BATCH_SIZE, users.length)}/${users.length} processed`);
    }

    this.logger.log(`🎉 Bulk send completed: ${successCount} success, ${failureCount} failed`);
  }

  // 🎯 개별 사용자에게 이메일 발송
  private async sendEmailToUser(user: User, template: Template, campaignId: string | null = null) {
    // 1. 이메일 주소 검증
    const userEmail = (user.properties as any)?.email;
    if (!userEmail) {
      throw new Error(`User ${user.id} has no email address`);
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
      }
    };

    const content = template.content as any;
    
    return {
      subject: await this.liquidEngine.parseAndRender(content.subject || '', scope),
      html: await this.liquidEngine.parseAndRender(
        content.body_html || content.body_markdown || content.body_text || content.message || '', 
        scope
      ),
    };
  }
  */
}
