import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WarmupStatus {
  currentDay: number;
  isComplete: boolean;
  todaysSentCount: number;
  todaysLimit: number;
  remainingToday: number;
  canSendMore: boolean;
  schedule: Array<{ day: number; maxEmails: number }>;
}

@Injectable()
export class WarmupService {
  private readonly logger = new Logger(WarmupService.name);

  // 🎯 표준 IP Warm-up 스케줄
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
    { day: 10, maxEmails: 25000 },
  ];

  constructor(private prisma: PrismaService) {}

  // 🎯 일일 발송 제한 확인
  async checkDailyLimit(workspaceId: string): Promise<boolean> {
    const status = await this.getWarmupStatus(workspaceId);
    return status.canSendMore;
  }

  // 🎯 일일 발송 카운터 증가
  async incrementDailyCount(workspaceId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      // PostgreSQL에 일일 카운터 저장/업데이트
      await this.prisma.$executeRaw`
        INSERT INTO workspace_settings (workspace_id, category, key, value, created_at, updated_at)
        VALUES (${workspaceId}, 'warmup', ${`daily_count_${today}`}, '1', NOW(), NOW())
        ON CONFLICT (workspace_id, category, key)
        DO UPDATE SET
          value = (CAST(workspace_settings.value AS INTEGER) + 1)::TEXT,
          updated_at = NOW()
      `;

      this.logger.debug(
        `Incremented daily count for workspace ${workspaceId} on ${today}`,
      );
    } catch (error) {
      this.logger.error(`Failed to increment daily count: ${error.message}`);
    }
  }

  // 🎯 일일 카운터 리셋 (Cloud Scheduler에서 매일 자정에 호출)
  async resetDailyCount(workspaceId: string, date: string): Promise<void> {
    try {
      // 이전 일자의 카운터 삭제 (7일 이전 데이터 정리)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];

      await this.prisma.workspaceSetting.deleteMany({
        where: {
          workspaceId,
          category: 'warmup',
          key: {
            startsWith: 'daily_count_',
            lt: `daily_count_${cutoffDate}`,
          },
        },
      });

      this.logger.log(
        `Reset daily count for workspace ${workspaceId} on ${date}`,
      );
    } catch (error) {
      this.logger.error(`Failed to reset daily count: ${error.message}`);
    }
  }

  // 🎯 워크스페이스 Warm-up 상태 조회
  async getWarmupStatus(workspaceId: string): Promise<WarmupStatus> {
    try {
      // 1. Warm-up 시작일 조회
      const warmupStartSetting = await this.prisma.workspaceSetting.findUnique({
        where: {
          workspaceId_category_key: {
            workspaceId,
            category: 'warmup',
            key: 'start_date',
          },
        },
      });

      let currentDay = 1;
      let startDate = new Date();

      if (warmupStartSetting) {
        startDate = new Date(warmupStartSetting.value);
        const daysSinceStart = Math.floor(
          (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        currentDay = Math.min(daysSinceStart + 1, 10); // 최대 10일
      } else {
        // 첫 번째 실행 시 시작일 설정
        await this.initializeWarmup(workspaceId);
        currentDay = 1;
      }

      // 2. 오늘 발송량 조회
      const today = new Date().toISOString().split('T')[0];
      const todayCountSetting = await this.prisma.workspaceSetting.findUnique({
        where: {
          workspaceId_category_key: {
            workspaceId,
            category: 'warmup',
            key: `daily_count_${today}`,
          },
        },
      });

      const todaysSentCount = todayCountSetting
        ? parseInt(todayCountSetting.value)
        : 0;

      // 3. 오늘 제한량 계산
      const todaysSchedule = this.WARMUP_SCHEDULE.find(
        (s) => s.day >= currentDay,
      );
      const todaysLimit = todaysSchedule ? todaysSchedule.maxEmails : 25000;

      const remainingToday = Math.max(0, todaysLimit - todaysSentCount);
      const canSendMore = remainingToday > 0;
      const isComplete = currentDay >= 10;

      return {
        currentDay,
        isComplete,
        todaysSentCount,
        todaysLimit,
        remainingToday,
        canSendMore,
        schedule: this.WARMUP_SCHEDULE,
      };
    } catch (error) {
      this.logger.error(`Failed to get warmup status: ${error.message}`);

      // 에러 시 기본값 반환 (발송 차단)
      return {
        currentDay: 1,
        isComplete: false,
        todaysSentCount: 0,
        todaysLimit: 0,
        remainingToday: 0,
        canSendMore: false,
        schedule: this.WARMUP_SCHEDULE,
      };
    }
  }

  // 🎯 워크스페이스 Warm-up 초기화
  private async initializeWarmup(workspaceId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      await this.prisma.workspaceSetting.create({
        data: {
          workspaceId,
          category: 'warmup',
          key: 'start_date',
          value: today,
        },
      });

      this.logger.log(
        `Initialized warmup for workspace ${workspaceId} starting ${today}`,
      );
    } catch (error) {
      // Unique constraint 에러는 무시 (이미 초기화됨)
      if (!error.code || error.code !== 'P2002') {
        this.logger.error(`Failed to initialize warmup: ${error.message}`);
      }
    }
  }

  // 🎯 모든 워크스페이스의 일일 카운터 리셋 (Cloud Scheduler용)
  async resetAllWorkspacesDaily(date: string): Promise<void> {
    try {
      // 모든 워크스페이스 조회
      const workspaces = await this.prisma.workspaceSetting.findMany({
        where: {
          category: 'warmup',
          key: 'start_date',
        },
        select: {
          workspaceId: true,
        },
        distinct: ['workspaceId'],
      });

      // 각 워크스페이스에 대해 일일 카운터 리셋
      await Promise.allSettled(
        workspaces.map((ws) => this.resetDailyCount(ws.workspaceId, date)),
      );

      this.logger.log(
        `Reset daily counters for ${workspaces.length} workspaces on ${date}`,
      );
    } catch (error) {
      this.logger.error(`Failed to reset all workspaces: ${error.message}`);
      throw error;
    }
  }

  // 🎯 Warm-up 수동 리셋 (관리자용)
  async resetWarmup(workspaceId: string): Promise<void> {
    try {
      // 모든 warm-up 관련 설정 삭제
      await this.prisma.workspaceSetting.deleteMany({
        where: {
          workspaceId,
          category: 'warmup',
        },
      });

      // 새로 초기화
      await this.initializeWarmup(workspaceId);

      this.logger.log(`Reset warmup for workspace ${workspaceId}`);
    } catch (error) {
      this.logger.error(`Failed to reset warmup: ${error.message}`);
      throw error;
    }
  }
}
