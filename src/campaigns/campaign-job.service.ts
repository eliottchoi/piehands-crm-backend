import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendGridService } from '../sendgrid/sendgrid.service';
import { TemplatesService } from '../templates/templates.service';
import { SettingsService } from '../settings/settings.service';
import { CloudTasksService } from '../tasks/cloud-tasks.service';
import { WarmupService } from '../tasks/warmup.service';

export interface CampaignJobConfig {
  campaignId: string;
  workspaceId: string;
  templateId: string;
  userFilter?: any;
  scheduledAt?: Date;
  maxEmailsPerDay?: number; // IP Warm-up 제한
  enableWarmup?: boolean;
}

export interface CampaignJobStatus {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  totalUsers: number;
  processedUsers: number;
  successCount: number;
  failureCount: number;
  currentBatch: number;
  startedAt?: Date | string;
  lastProcessedAt?: Date | string;
  estimatedCompletion?: Date | string;
  warmupDay?: number;
  dailyLimitReached?: boolean;
}

@Injectable()
export class CampaignJobService {
  private readonly logger = new Logger(CampaignJobService.name);
  private runningJobs = new Map<string, CampaignJobStatus>();

  // 🎯 표준 IP Warm-up 스케줄 (전용 IP 기준)
  private readonly WARMUP_SCHEDULE = [
    { day: 1, maxEmails: 50 },
    { day: 2, maxEmails: 100 },
    { day: 3, maxEmails: 250 },
    { day: 4, maxEmails: 500 },
    { day: 5, maxEmails: 1000 },
    { day: 6, maxEmails: 2000 },
    { day: 7, maxEmails: 4000 },
    { day: 8, maxEmails: 8000 },
    { day: 9, maxEmails: 16000 },
    { day: 10, maxEmails: 25000 }, // 이후 무제한
  ];

  constructor(
    private prisma: PrismaService,
    private sendGridService: SendGridService,
    private templatesService: TemplatesService,
    private settingsService: SettingsService,
    private cloudTasksService: CloudTasksService,
    private warmupService: WarmupService,
  ) {}

  // 🎯 캠페인 작업 시작 (Cloud Tasks 기반)
  async startCampaignJob(config: CampaignJobConfig): Promise<string> {
    const jobId = `campaign_${config.campaignId}_${Date.now()}`;

    try {
      // 1. 사용자 목록 조회
      const users = await this.getUsersForCampaign(config);

      // 2. Warm-up 상태 확인
      const warmupStatus = await this.warmupService.getWarmupStatus(config.workspaceId);

      // 3. 오늘 발송 가능한 수량 계산
      const availableToday = warmupStatus.remainingToday;
      const usersToSendToday = users.slice(0, availableToday);
      const remainingUsers = users.slice(availableToday);

      // 4. 작업 상태 초기화
      const jobStatus: CampaignJobStatus = {
        id: jobId,
        status: 'running',
        totalUsers: users.length,
        processedUsers: 0,
        successCount: 0,
        failureCount: 0,
        currentBatch: 0,
        warmupDay: warmupStatus.currentDay,
        dailyLimitReached: remainingUsers.length > 0,
      };

      this.runningJobs.set(jobId, jobStatus);
      await this.saveCampaignJobStatus(jobId, jobStatus, config);

      // 5. 오늘 발송할 이메일들을 Cloud Tasks에 즉시 스케줄링
      if (usersToSendToday.length > 0) {
        await this.cloudTasksService.scheduleCampaignBatch(
          config.campaignId,
          usersToSendToday.map(u => u.id),
          config.templateId,
          undefined, // 즉시 실행
          config.workspaceId
        );

        this.logger.log(`Scheduled ${usersToSendToday.length} emails for immediate sending`);
      }

      // 6. 남은 사용자들을 내일 이후로 스케줄링
      if (remainingUsers.length > 0) {
        await this.scheduleRemainingUsers(config, remainingUsers, warmupStatus.currentDay + 1);
        this.logger.log(`Scheduled ${remainingUsers.length} emails for future sending`);
      }

      this.logger.log(`Campaign job ${jobId} started: ${usersToSendToday.length} today, ${remainingUsers.length} scheduled`);
      return jobId;

    } catch (error) {
      this.logger.error(`Failed to start campaign job: ${error.message}`);
      throw error;
    }
  }

  // 🎯 작업 실행 (재시작 가능)
  private async executeCampaignJob(
    jobId: string,
    config: CampaignJobConfig,
    users: any[],
    dailyLimit: number
  ) {
    const jobStatus = this.runningJobs.get(jobId);
    if (!jobStatus) return;

    try {
      jobStatus.status = 'running';
      jobStatus.startedAt = new Date();
      await this.updateCampaignJobInDB(jobId, jobStatus);

      // 템플릿 로드
      const template = await this.prisma.template.findUnique({
        where: { id: config.templateId }
      });
      if (!template) {
        throw new Error(`Template ${config.templateId} not found`);
      }

      // 일일 발송량 추적
      let todaysSentCount = await this.getTodaysSentCount(config.workspaceId);

      // 이미 처리된 사용자는 건너뛰기 (재시작 지원)
      const remainingUsers = users.slice(jobStatus.processedUsers);

      // Rate limiting 설정
      const BATCH_SIZE = 10; // SendGrid 권장 배치 크기
      const DELAY_MS = 1000; // 1초 대기

      for (let i = 0; i < remainingUsers.length; i += BATCH_SIZE) {
        // 작업 상태 확인 (일시정지/취소 체크)
        const currentStatus = this.runningJobs.get(jobId);
        if (!currentStatus || currentStatus.status !== 'running') {
          this.logger.log(`Campaign job ${jobId} was ${currentStatus?.status || 'stopped'}`);
          return;
        }

        // 일일 제한 확인
        if (todaysSentCount >= dailyLimit) {
          jobStatus.dailyLimitReached = true;
          jobStatus.status = 'paused';
          await this.updateCampaignJobInDB(jobId, jobStatus);
          this.logger.log(`Campaign job ${jobId} paused - daily limit reached (${dailyLimit})`);

          // 다음날 자동 재시작 스케줄링
          await this.scheduleNextDayResume(jobId, config);
          return;
        }

        const batch = remainingUsers.slice(i, i + BATCH_SIZE);
        jobStatus.currentBatch = Math.floor(jobStatus.processedUsers / BATCH_SIZE) + 1;

        // 배치 처리
        const batchResults = await Promise.allSettled(
          batch.map(user => this.sendEmailToUser(user, template, config))
        );

        // 결과 집계
        for (const result of batchResults) {
          jobStatus.processedUsers++;
          if (result.status === 'fulfilled' && result.value.success) {
            jobStatus.successCount++;
            todaysSentCount++;
          } else {
            jobStatus.failureCount++;
            this.logger.warn(`Email failed: ${result.status === 'rejected' ? result.reason : 'Unknown error'}`);
          }
        }

        jobStatus.lastProcessedAt = new Date();

        // 예상 완료 시간 계산
        const remaining = jobStatus.totalUsers - jobStatus.processedUsers;
        const rate = jobStatus.processedUsers / (Date.now() - jobStatus.startedAt.getTime());
        jobStatus.estimatedCompletion = new Date(Date.now() + (remaining / rate));

        // 진행 상황 저장 (5초마다 또는 배치 완료시)
        if (jobStatus.currentBatch % 5 === 0 || jobStatus.processedUsers === jobStatus.totalUsers) {
          await this.updateCampaignJobInDB(jobId, jobStatus);
        }

        // 다음 배치 전 대기 (Rate limiting)
        if (i + BATCH_SIZE < remainingUsers.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      // 작업 완료
      jobStatus.status = 'completed';
      await this.updateCampaignJobInDB(jobId, jobStatus);

      this.logger.log(`Campaign job ${jobId} completed: ${jobStatus.successCount}/${jobStatus.totalUsers} sent`);

    } catch (error) {
      jobStatus.status = 'failed';
      await this.updateCampaignJobInDB(jobId, jobStatus);
      throw error;
    }
  }

  // 🎯 사용자에게 이메일 발송
  private async sendEmailToUser(user: any, template: any, config: CampaignJobConfig) {
    try {
      // 이미 발송된 이메일인지 확인 (중복 방지)
      const existingLog = await this.prisma.emailLog.findFirst({
        where: {
          userId: user.id,
          campaignId: config.campaignId,
          status: { in: ['sent', 'delivered'] }
        }
      });

      if (existingLog) {
        return { success: true, skipped: true, reason: 'already_sent' };
      }

      // 사용자가 수신 거부했는지 확인
      if (user.emailStatus === 'unsubscribed' || user.emailStatus === 'bounced') {
        return { success: false, skipped: true, reason: user.emailStatus };
      }

      // 템플릿 렌더링 (간단한 구현)
      const userProperties = (user.properties || {}) as Record<string, any>;
      const scope = {
        user: {
          id: user.id,
          distinctId: user.distinctId,
          name: userProperties.name || 'User',
          email: userProperties.email || '',
          ...userProperties,
        }
      };

      // 간단한 변수 치환 (실제로는 Liquid 엔진 사용)
      const templateContent = template.content as any;
      const rendered = {
        subject: templateContent.subject || 'No Subject',
        html: templateContent.body || '<p>No Content</p>',
      };

      // 이메일 발송
      const result = await this.sendGridService.sendEmail({
        to: user.properties.email,
        subject: rendered.subject,
        html: rendered.html,
        userId: user.id,
        workspaceId: config.workspaceId,
        campaignId: config.campaignId,
        templateId: config.templateId,
      });

      return { success: result.success, messageId: result.messageId };

    } catch (error) {
      this.logger.error(`Failed to send email to user ${user.id}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // 🎯 작업 일시정지
  async pauseCampaignJob(jobId: string): Promise<boolean> {
    const jobStatus = this.runningJobs.get(jobId);
    if (!jobStatus || jobStatus.status !== 'running') {
      return false;
    }

    jobStatus.status = 'paused';
    await this.updateCampaignJobInDB(jobId, jobStatus);
    this.logger.log(`Campaign job ${jobId} paused`);
    return true;
  }

  // 🎯 작업 재시작
  async resumeCampaignJob(jobId: string): Promise<boolean> {
    const jobStatus = this.runningJobs.get(jobId);
    if (!jobStatus || jobStatus.status !== 'paused') {
      return false;
    }

    // DB에서 최신 상태 로드
    const savedJob = await this.loadCampaignJobFromDB(jobId);
    if (savedJob) {
      // 중단된 지점부터 재시작
      const config = savedJob.config as unknown as CampaignJobConfig;
      const users = await this.getUsersForCampaign(config);

      // Warm-up 상태 재확인
      let dailyLimit = config.maxEmailsPerDay;
      if (config.enableWarmup) {
        const warmupStatus = await this.getWarmupStatus(config.workspaceId);
        const warmupSchedule = this.WARMUP_SCHEDULE.find(s => s.day >= warmupStatus.currentDay);
        dailyLimit = Math.min(dailyLimit || Number.MAX_SAFE_INTEGER, warmupSchedule?.maxEmails || 25000);
      }

      this.executeCampaignJob(jobId, config, users, dailyLimit).catch(error => {
        this.logger.error(`Campaign job ${jobId} failed on resume: ${error.message}`);
        this.updateJobStatus(jobId, { status: 'failed' });
      });

      this.logger.log(`Campaign job ${jobId} resumed from ${jobStatus.processedUsers}/${jobStatus.totalUsers}`);
      return true;
    }

    return false;
  }

  // 🎯 작업 상태 조회
  async getCampaignJobStatus(jobId: string): Promise<CampaignJobStatus | null> {
    const runningJob = this.runningJobs.get(jobId);
    if (runningJob) return runningJob;

    const savedJob = await this.loadCampaignJobFromDB(jobId);
    if (!savedJob) return null;

    return {
      id: savedJob.id,
      status: savedJob.status as any,
      totalUsers: savedJob.totalUsers,
      processedUsers: savedJob.processedUsers,
      successCount: savedJob.successCount,
      failureCount: savedJob.failureCount,
      currentBatch: savedJob.currentBatch,
      startedAt: savedJob.startedAt?.toISOString(),
      lastProcessedAt: savedJob.lastProcessedAt?.toISOString(),
      estimatedCompletion: savedJob.estimatedCompletion?.toISOString(),
      warmupDay: savedJob.warmupDay,
      dailyLimitReached: savedJob.dailyLimitReached,
    };
  }

  // 🎯 워크스페이스의 모든 작업 조회
  async getWorkspaceCampaignJobs(workspaceId: string): Promise<CampaignJobStatus[]> {
    const jobs = await this.prisma.campaignJob.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return jobs.map(job => ({
      id: job.id,
      status: job.status as any,
      totalUsers: job.totalUsers,
      processedUsers: job.processedUsers,
      successCount: job.successCount,
      failureCount: job.failureCount,
      currentBatch: job.currentBatch,
      startedAt: job.startedAt,
      lastProcessedAt: job.lastProcessedAt,
      estimatedCompletion: job.estimatedCompletion,
      warmupDay: job.warmupDay,
      dailyLimitReached: job.dailyLimitReached,
    }));
  }

  // 🎯 IP Warm-up 상태 조회
  private async getWarmupStatus(workspaceId: string) {
    const settings = await this.settingsService.getSendGridSettings(workspaceId);
    const warmupStartDate = settings.warmup_start_date || new Date();

    const daysSinceStart = Math.floor(
      (Date.now() - warmupStartDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    return {
      currentDay: Math.min(daysSinceStart, 10),
      isComplete: daysSinceStart >= 10,
      startDate: warmupStartDate,
    };
  }

  // 🎯 오늘 발송한 이메일 수 조회
  private async getTodaysSentCount(workspaceId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const count = await this.prisma.emailLog.count({
      where: {
        user: { workspaceId },
        status: { in: ['sent', 'delivered'] },
        sentAt: {
          gte: today,
          lt: tomorrow,
        }
      }
    });

    return count;
  }

  // 🎯 캠페인용 사용자 목록 조회
  private async getUsersForCampaign(config: CampaignJobConfig) {
    return await this.prisma.user.findMany({
      where: {
        workspaceId: config.workspaceId,
        emailStatus: { not: 'unsubscribed' },
        properties: {
          path: ['email'],
          not: null,
        },
        ...config.userFilter,
      },
      select: {
        id: true,
        distinctId: true,
        properties: true,
        emailStatus: true,
      }
    });
  }

  // 🎯 남은 사용자들을 향후 일정으로 스케줄링
  private async scheduleRemainingUsers(
    config: CampaignJobConfig,
    remainingUsers: any[],
    startDay: number
  ): Promise<void> {
    let currentDay = startDay;
    let processedUsers = 0;

    while (processedUsers < remainingUsers.length && currentDay <= 10) {
      const warmupLimit = this.WARMUP_SCHEDULE.find(s => s.day >= currentDay)?.maxEmails || 25000;
      const usersForDay = remainingUsers.slice(processedUsers, processedUsers + warmupLimit);

      if (usersForDay.length === 0) break;

      // 해당 날짜의 오전 9시로 스케줄링
      const scheduleDate = new Date();
      scheduleDate.setDate(scheduleDate.getDate() + (currentDay - 1));
      scheduleDate.setHours(9, 0, 0, 0);

      // Cloud Tasks에 스케줄링
      await this.cloudTasksService.scheduleCampaignBatch(
        config.campaignId,
        usersForDay.map(u => u.id),
        config.templateId,
        scheduleDate,
        config.workspaceId
      );

      this.logger.log(`Scheduled ${usersForDay.length} emails for day ${currentDay} (${scheduleDate.toISOString()})`);

      processedUsers += usersForDay.length;
      currentDay++;
    }

    // 10일 후에도 남은 사용자가 있다면 일일 최대량으로 계속 스케줄링
    if (processedUsers < remainingUsers.length) {
      const finalUsers = remainingUsers.slice(processedUsers);
      const scheduleDate = new Date();
      scheduleDate.setDate(scheduleDate.getDate() + 10);
      scheduleDate.setHours(9, 0, 0, 0);

      await this.cloudTasksService.scheduleCampaignBatch(
        config.campaignId,
        finalUsers.map(u => u.id),
        config.templateId,
        scheduleDate,
        config.workspaceId
      );

      this.logger.log(`Scheduled final ${finalUsers.length} emails for post-warmup (${scheduleDate.toISOString()})`);
    }
  }

  // 🎯 다음날 자동 재시작 스케줄링 (레거시 - Cloud Tasks로 대체됨)
  private async scheduleNextDayResume(jobId: string, config: CampaignJobConfig) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 오전 9시에 재시작

    this.logger.log(`Campaign job ${jobId} scheduled to resume at ${tomorrow.toISOString()}`);
    // Cloud Tasks로 대체되어 setTimeout 제거
  }

  // Helper methods for DB operations
  private async saveCampaignJobStatus(jobId: string, status: CampaignJobStatus, config: CampaignJobConfig) {
    await this.prisma.campaignJob.create({
      data: {
        id: jobId,
        workspaceId: config.workspaceId,
        campaignId: config.campaignId,
        templateId: config.templateId,
        status: status.status,
        totalUsers: status.totalUsers,
        processedUsers: status.processedUsers,
        successCount: status.successCount,
        failureCount: status.failureCount,
        currentBatch: status.currentBatch,
        warmupDay: status.warmupDay,
        dailyLimitReached: status.dailyLimitReached,
        config: config as any,
      }
    });
  }

  private async updateCampaignJobInDB(jobId: string, status: CampaignJobStatus) {
    await this.prisma.campaignJob.update({
      where: { id: jobId },
      data: {
        status: status.status,
        processedUsers: status.processedUsers,
        successCount: status.successCount,
        failureCount: status.failureCount,
        currentBatch: status.currentBatch,
        startedAt: status.startedAt,
        lastProcessedAt: status.lastProcessedAt,
        estimatedCompletion: status.estimatedCompletion,
        dailyLimitReached: status.dailyLimitReached,
      }
    });
  }

  private async loadCampaignJobFromDB(jobId: string) {
    return await this.prisma.campaignJob.findUnique({
      where: { id: jobId }
    });
  }

  private updateJobStatus(jobId: string, updates: Partial<CampaignJobStatus>) {
    const job = this.runningJobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
    }
  }
}