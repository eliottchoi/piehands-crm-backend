import { Injectable, Logger } from '@nestjs/common';
import { CloudTasksClient } from '@google-cloud/tasks';

export interface EmailTaskPayload {
  userId: string;
  campaignId?: string;
  templateId?: string;
  to: string;
  subject: string;
  html: string;
  workspaceId: string;
  priority?: 'high' | 'normal';
  scheduleTime?: Date;
}

export interface WarmupResetPayload {
  workspaceId: string | 'all'; // 'all'인 경우 모든 워크스페이스
  date: string; // YYYY-MM-DD
}

@Injectable()
export class CloudTasksService {
  private readonly logger = new Logger(CloudTasksService.name);
  private readonly client: CloudTasksClient;
  private readonly projectId: string;
  private readonly location: string;

  constructor() {
    this.client = new CloudTasksClient();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'agent-growth-and-ops';
    this.location = process.env.GOOGLE_CLOUD_REGION || 'us-central1';
  }

  // 🎯 이메일 발송 작업 큐에 추가
  async scheduleEmailTask(payload: EmailTaskPayload): Promise<string> {
    const queueName = payload.priority === 'high' ? 'email-high-priority' : 'email-sending';
    const queuePath = this.client.queuePath(this.projectId, this.location, queueName);

    const task = {
      httpRequest: {
        url: `${this.getServiceUrl()}/tasks/send-email`,
        httpMethod: 'POST' as const,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
      scheduleTime: payload.scheduleTime ? {
        seconds: Math.floor(payload.scheduleTime.getTime() / 1000),
      } : undefined,
    };

    try {
      const [response] = await this.client.createTask({
        parent: queuePath,
        task,
      });

      this.logger.log(`Email task scheduled: ${response.name}`);
      return response.name;
    } catch (error) {
      this.logger.error(`Failed to schedule email task: ${error.message}`);
      throw error;
    }
  }

  // 🎯 IP Warm-up 리셋 작업 스케줄링 (매일 자정)
  async scheduleWarmupReset(payload: WarmupResetPayload, scheduleTime: Date): Promise<string> {
    const queuePath = this.client.queuePath(this.projectId, this.location, 'warmup-management');

    const task = {
      httpRequest: {
        url: `${this.getServiceUrl()}/tasks/reset-warmup`,
        httpMethod: 'POST' as const,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
      scheduleTime: {
        seconds: Math.floor(scheduleTime.getTime() / 1000),
      },
    };

    try {
      const [response] = await this.client.createTask({
        parent: queuePath,
        task,
      });

      this.logger.log(`Warmup reset task scheduled: ${response.name} for ${scheduleTime}`);
      return response.name;
    } catch (error) {
      this.logger.error(`Failed to schedule warmup reset: ${error.message}`);
      throw error;
    }
  }

  // 🎯 캠페인 작업 배치 스케줄링
  async scheduleCampaignBatch(
    campaignId: string,
    userIds: string[],
    templateId: string,
    scheduleTime?: Date,
    workspaceId?: string
  ): Promise<string[]> {
    const tasks: Promise<string>[] = [];

    for (const userId of userIds) {
      const taskPayload: EmailTaskPayload = {
        userId,
        campaignId,
        templateId,
        to: '', // 실제 실행 시 User 정보에서 조회
        subject: '', // 실제 실행 시 Template 정보에서 조회
        html: '', // 실제 실행 시 Template 정보에서 조회
        workspaceId: workspaceId || '', // 실제 실행 시 Campaign 정보에서 조회
        scheduleTime,
      };

      tasks.push(this.scheduleEmailTask(taskPayload));
    }

    try {
      const taskNames = await Promise.all(tasks);
      this.logger.log(`Scheduled ${taskNames.length} email tasks for campaign ${campaignId}`);
      return taskNames;
    } catch (error) {
      this.logger.error(`Failed to schedule campaign batch: ${error.message}`);
      throw error;
    }
  }

  // 🎯 Helper: 현재 서비스 URL 가져오기
  private getServiceUrl(): string {
    if (process.env.NODE_ENV === 'production') {
      return 'https://piehands-crm-backend-310117686396.us-central1.run.app';
    }
    return 'http://localhost:3000';
  }

  // 🎯 큐 생성 헬퍼 (배포 시 한 번만 실행)
  async createQueues(): Promise<void> {
    const queues = [
      {
        name: 'email-sending',
        rateLimits: {
          maxDispatchesPerSecond: 50, // SendGrid 제한 고려
          maxBurstSize: 100,
        },
        retryConfig: {
          maxAttempts: 5,
          maxRetryDuration: { seconds: 3600 }, // 1시간
          minBackoff: { seconds: 10 },
          maxBackoff: { seconds: 300 },
          maxDoublings: 5,
        },
      },
      {
        name: 'email-high-priority',
        rateLimits: {
          maxDispatchesPerSecond: 20,
          maxBurstSize: 50,
        },
        retryConfig: {
          maxAttempts: 3,
          maxRetryDuration: { seconds: 1800 },
          minBackoff: { seconds: 5 },
          maxBackoff: { seconds: 60 },
          maxDoublings: 3,
        },
      },
      {
        name: 'warmup-management',
        rateLimits: {
          maxDispatchesPerSecond: 10,
          maxBurstSize: 20,
        },
        retryConfig: {
          maxAttempts: 3,
          maxRetryDuration: { seconds: 300 },
          minBackoff: { seconds: 30 },
          maxBackoff: { seconds: 120 },
          maxDoublings: 2,
        },
      },
    ];

    for (const queueConfig of queues) {
      const queuePath = this.client.queuePath(this.projectId, this.location, queueConfig.name);

      try {
        await this.client.createQueue({
          parent: this.client.locationPath(this.projectId, this.location),
          queue: {
            name: queuePath,
            rateLimits: queueConfig.rateLimits,
            retryConfig: queueConfig.retryConfig,
          },
        });
        this.logger.log(`Created queue: ${queueConfig.name}`);
      } catch (error) {
        if (error.code === 6) { // ALREADY_EXISTS
          this.logger.log(`Queue already exists: ${queueConfig.name}`);
        } else {
          this.logger.error(`Failed to create queue ${queueConfig.name}: ${error.message}`);
        }
      }
    }
  }
}