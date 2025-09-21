import { Controller, Get, Post, Put, Body, Param, Query, Logger } from '@nestjs/common';
import { CampaignJobService, CampaignJobConfig } from './campaign-job.service';
import { WarmupService } from '../tasks/warmup.service';

export class StartCampaignJobDto {
  campaignId: string;
  workspaceId: string;
  templateId: string;
  userFilter?: any;
  scheduledAt?: string;
  maxEmailsPerDay?: number;
  enableWarmup?: boolean;
}

export class CampaignJobControlDto {
  action: 'pause' | 'resume' | 'cancel';
}

@Controller('campaign-jobs')
export class CampaignJobController {
  private readonly logger = new Logger(CampaignJobController.name);

  constructor(
    private campaignJobService: CampaignJobService,
    private warmupService: WarmupService,
  ) {}

  // 🎯 캠페인 발송 작업 시작
  @Post('start')
  async startCampaignJob(@Body() dto: StartCampaignJobDto) {
    const config: CampaignJobConfig = {
      campaignId: dto.campaignId,
      workspaceId: dto.workspaceId,
      templateId: dto.templateId,
      userFilter: dto.userFilter,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      maxEmailsPerDay: dto.maxEmailsPerDay,
      enableWarmup: dto.enableWarmup ?? true, // 기본적으로 Warm-up 활성화
    };

    const jobId = await this.campaignJobService.startCampaignJob(config);

    this.logger.log(`Campaign job started: ${jobId}`);

    return {
      success: true,
      jobId,
      message: 'Campaign job started successfully',
    };
  }

  // 🎯 작업 상태 조회
  @Get(':jobId')
  async getCampaignJobStatus(@Param('jobId') jobId: string) {
    const status = await this.campaignJobService.getCampaignJobStatus(jobId);

    if (!status) {
      return {
        success: false,
        message: 'Campaign job not found',
      };
    }

    return {
      success: true,
      data: status,
    };
  }

  // 🎯 작업 제어 (일시정지/재시작/취소)
  @Put(':jobId/control')
  async controlCampaignJob(
    @Param('jobId') jobId: string,
    @Body() dto: CampaignJobControlDto
  ) {
    let success = false;
    let message = '';

    switch (dto.action) {
      case 'pause':
        success = await this.campaignJobService.pauseCampaignJob(jobId);
        message = success ? 'Campaign job paused' : 'Failed to pause campaign job';
        break;

      case 'resume':
        success = await this.campaignJobService.resumeCampaignJob(jobId);
        message = success ? 'Campaign job resumed' : 'Failed to resume campaign job';
        break;

      case 'cancel':
        // 취소 기능 구현 (TODO)
        message = 'Cancel feature not implemented yet';
        break;

      default:
        message = 'Invalid action';
    }

    this.logger.log(`Campaign job ${jobId} ${dto.action}: ${success ? 'success' : 'failed'}`);

    return {
      success,
      message,
    };
  }

  // 🎯 워크스페이스의 모든 캠페인 작업 조회
  @Get()
  async getWorkspaceCampaignJobs(@Query('workspaceId') workspaceId: string) {
    if (!workspaceId) {
      return {
        success: false,
        message: 'workspaceId is required',
      };
    }

    const jobs = await this.campaignJobService.getWorkspaceCampaignJobs(workspaceId);

    return {
      success: true,
      data: jobs,
    };
  }

  // 🎯 실시간 진행 상황 조회 (Server-Sent Events)
  @Get(':jobId/progress')
  async getCampaignJobProgress(@Param('jobId') jobId: string) {
    const status = await this.campaignJobService.getCampaignJobStatus(jobId);

    if (!status) {
      return {
        success: false,
        message: 'Campaign job not found',
      };
    }

    // 진행률 계산
    const progressPercentage = status.totalUsers > 0
      ? Math.round((status.processedUsers / status.totalUsers) * 100)
      : 0;

    // 처리량 계산 (이메일/시간)
    let emailsPerHour = 0;
    if (status.startedAt && status.processedUsers > 0) {
      const startTime = typeof status.startedAt === 'string'
        ? new Date(status.startedAt).getTime()
        : status.startedAt.getTime();
      const elapsedHours = (Date.now() - startTime) / (1000 * 60 * 60);
      emailsPerHour = Math.round(status.processedUsers / elapsedHours);
    }

    // 성공률 계산
    const successRate = status.processedUsers > 0
      ? Math.round((status.successCount / status.processedUsers) * 100)
      : 0;

    return {
      success: true,
      data: {
        ...status,
        progressPercentage,
        emailsPerHour,
        successRate,
        remainingUsers: status.totalUsers - status.processedUsers,
      },
    };
  }

  // 🎯 IP Warm-up 상태 조회
  @Get('warmup/:workspaceId/status')
  async getWarmupStatus(@Param('workspaceId') workspaceId: string) {
    this.logger.log(`Fetching warmup status for workspace: ${workspaceId}`);
    try {
      const warmupStatus = await this.warmupService.getWarmupStatus(workspaceId);
      this.logger.debug(`Warmup status for ${workspaceId}: ${JSON.stringify(warmupStatus)}`);

      return {
        success: true,
        data: warmupStatus,
      };
    } catch (error) {
      this.logger.error(`Failed to get warmup status for ${workspaceId}: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Failed to get warmup status: ${error.message}`,
      };
    }
  }
}