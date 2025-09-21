import { Injectable, Logger } from '@nestjs/common';
import * as sgClient from '@sendgrid/client';
import { SettingsService } from '../settings/settings.service';

export interface SendGridStats {
  date: string;
  stats: Array<{
    metrics: {
      blocks: number;
      bounce_drops: number;
      bounces: number;
      clicks: number;
      deferred: number;
      delivered: number;
      invalid_emails: number;
      opens: number;
      processed: number;
      requests: number;
      spam_report_drops: number;
      spam_reports: number;
      unique_clicks: number;
      unique_opens: number;
      unsubscribe_drops: number;
      unsubscribes: number;
    };
  }>;
}

export interface ReputationData {
  reputation: number;
  ip: string;
  region: string;
  last_updated: string;
}

export interface SendGridAccount {
  type: string;
  reputation: number;
  email: string;
  username: string;
}

@Injectable()
export class SendGridStatsService {
  private readonly logger = new Logger(SendGridStatsService.name);
  private client: any;

  constructor(private settingsService: SettingsService) {
    this.client = sgClient;
  }

  // 🎯 워크스페이스별 SendGrid 설정
  private async initializeClient(workspaceId: string) {
    const settings = await this.settingsService.getSendGridSettings(workspaceId);
    const apiKey = settings.api_key || process.env.SENDGRID_API_KEY;

    if (!apiKey) {
      throw new Error('SendGrid API key not configured');
    }

    this.client.setApiKey(apiKey);
    return apiKey;
  }

  // 🎯 전체 통계 조회 (대시보드용)
  async getStats(workspaceId: string, startDate: string, endDate?: string): Promise<SendGridStats[]> {
    try {
      await this.initializeClient(workspaceId);

      const params: any = {
        start_date: startDate,
      };

      if (endDate) {
        params.end_date = endDate;
      }

      const queryString = new URLSearchParams(params).toString();
      const request = {
        url: `/v3/stats?${queryString}`,
        method: 'GET' as const,
      };

      const [response, body] = await this.client.request(request);

      if (response.statusCode === 200) {
        return body;
      } else {
        throw new Error(`SendGrid API error: ${response.statusCode}`);
      }

    } catch (error) {
      this.logger.error(`Failed to get SendGrid stats: ${error.message}`);
      throw error;
    }
  }

  // 🎯 전용 IP 평판 조회
  async getIPReputation(workspaceId: string): Promise<ReputationData[]> {
    try {
      await this.initializeClient(workspaceId);

      const request = {
        url: '/v3/ips',
        method: 'GET' as const,
      };

      const [response, body] = await this.client.request(request);

      if (response.statusCode === 200) {
        // IP 목록을 가져온 후, 각 IP의 평판 정보 조회
        const ipReputations = await Promise.all(
          body.map(async (ip: any) => {
            try {
              const reputationRequest = {
                url: `/v3/ips/${ip.ip}/reputation`,
                method: 'GET' as const,
              };

              const [repResponse, repBody] = await this.client.request(reputationRequest);

              return {
                ip: ip.ip,
                reputation: repBody.reputation || 0,
                region: ip.region || 'unknown',
                last_updated: new Date().toISOString(),
              };
            } catch (error) {
              this.logger.warn(`Failed to get reputation for IP ${ip.ip}: ${error.message}`);
              return {
                ip: ip.ip,
                reputation: 0,
                region: ip.region || 'unknown',
                last_updated: new Date().toISOString(),
              };
            }
          })
        );

        return ipReputations;
      } else {
        throw new Error(`SendGrid API error: ${response.statusCode}`);
      }

    } catch (error) {
      this.logger.error(`Failed to get IP reputation: ${error.message}`);
      throw error;
    }
  }

  // 🎯 계정 정보 및 평판 조회
  async getAccountInfo(workspaceId: string): Promise<SendGridAccount> {
    try {
      await this.initializeClient(workspaceId);

      const request = {
        url: '/v3/user/profile',
        method: 'GET' as const,
      };

      const [response, body] = await this.client.request(request);

      if (response.statusCode === 200) {
        // 계정 평판 정보도 함께 조회
        let reputation = 0;
        try {
          const reputationRequest = {
            url: '/v3/user/reputation',
            method: 'GET' as const,
          };
          const [repResponse, repBody] = await this.client.request(reputationRequest);
          reputation = repBody.reputation || 0;
        } catch (error) {
          this.logger.warn(`Failed to get account reputation: ${error.message}`);
        }

        return {
          type: body.type || 'unknown',
          reputation,
          email: body.email || '',
          username: body.username || '',
        };
      } else {
        throw new Error(`SendGrid API error: ${response.statusCode}`);
      }

    } catch (error) {
      this.logger.error(`Failed to get account info: ${error.message}`);
      throw error;
    }
  }

  // 🎯 스팸 신고 분석
  async getSpamReports(workspaceId: string, startDate: string, endDate?: string) {
    try {
      await this.initializeClient(workspaceId);

      const params: any = {
        start_date: startDate,
      };

      if (endDate) {
        params.end_date = endDate;
      }

      const queryString = new URLSearchParams(params).toString();
      const request = {
        url: `/v3/suppression/spam_reports?${queryString}&limit=100`,
        method: 'GET' as const,
      };

      const [response, body] = await this.client.request(request);

      if (response.statusCode === 200) {
        return body;
      } else {
        throw new Error(`SendGrid API error: ${response.statusCode}`);
      }

    } catch (error) {
      this.logger.error(`Failed to get spam reports: ${error.message}`);
      throw error;
    }
  }

  // 🎯 반송 분석
  async getBounces(workspaceId: string, startDate: string, endDate?: string) {
    try {
      await this.initializeClient(workspaceId);

      const params: any = {
        start_date: startDate,
      };

      if (endDate) {
        params.end_date = endDate;
      }

      const queryString = new URLSearchParams(params).toString();
      const request = {
        url: `/v3/suppression/bounces?${queryString}&limit=100`,
        method: 'GET' as const,
      };

      const [response, body] = await this.client.request(request);

      if (response.statusCode === 200) {
        return body;
      } else {
        throw new Error(`SendGrid API error: ${response.statusCode}`);
      }

    } catch (error) {
      this.logger.error(`Failed to get bounces: ${error.message}`);
      throw error;
    }
  }

  // 🎯 수신 거부 분석
  async getUnsubscribes(workspaceId: string, startDate: string, endDate?: string) {
    try {
      await this.initializeClient(workspaceId);

      const params: any = {
        start_date: startDate,
      };

      if (endDate) {
        params.end_date = endDate;
      }

      const queryString = new URLSearchParams(params).toString();
      const request = {
        url: `/v3/suppression/unsubscribes?${queryString}&limit=100`,
        method: 'GET' as const,
      };

      const [response, body] = await this.client.request(request);

      if (response.statusCode === 200) {
        return body;
      } else {
        throw new Error(`SendGrid API error: ${response.statusCode}`);
      }

    } catch (error) {
      this.logger.error(`Failed to get unsubscribes: ${error.message}`);
      throw error;
    }
  }

  // 🎯 종합 대시보드 데이터
  async getDashboardData(workspaceId: string, days: number = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    try {
      // 병렬로 모든 데이터 조회
      const [stats, ipReputation, accountInfo, spamReports, bounces, unsubscribes] = await Promise.allSettled([
        this.getStats(workspaceId, startDateStr, endDateStr),
        this.getIPReputation(workspaceId),
        this.getAccountInfo(workspaceId),
        this.getSpamReports(workspaceId, startDateStr, endDateStr),
        this.getBounces(workspaceId, startDateStr, endDateStr),
        this.getUnsubscribes(workspaceId, startDateStr, endDateStr),
      ]);

      // 통계 집계
      let totalSent = 0;
      let totalDelivered = 0;
      let totalOpens = 0;
      let totalClicks = 0;
      let totalBounces = 0;
      let totalSpamReports = 0;
      let totalUnsubscribes = 0;

      if (stats.status === 'fulfilled' && stats.value.length > 0) {
        stats.value.forEach(day => {
          day.stats.forEach(stat => {
            totalSent += stat.metrics.requests || 0;
            totalDelivered += stat.metrics.delivered || 0;
            totalOpens += stat.metrics.unique_opens || 0;
            totalClicks += stat.metrics.unique_clicks || 0;
            totalBounces += stat.metrics.bounces || 0;
            totalSpamReports += stat.metrics.spam_reports || 0;
            totalUnsubscribes += stat.metrics.unsubscribes || 0;
          });
        });
      }

      // 비율 계산
      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
      const openRate = totalDelivered > 0 ? (totalOpens / totalDelivered) * 100 : 0;
      const clickRate = totalDelivered > 0 ? (totalClicks / totalDelivered) * 100 : 0;
      const bounceRate = totalSent > 0 ? (totalBounces / totalSent) * 100 : 0;
      const spamRate = totalSent > 0 ? (totalSpamReports / totalSent) * 100 : 0;
      const unsubscribeRate = totalDelivered > 0 ? (totalUnsubscribes / totalDelivered) * 100 : 0;

      return {
        summary: {
          totalSent,
          totalDelivered,
          totalOpens,
          totalClicks,
          totalBounces,
          totalSpamReports,
          totalUnsubscribes,
          deliveryRate: Math.round(deliveryRate * 100) / 100,
          openRate: Math.round(openRate * 100) / 100,
          clickRate: Math.round(clickRate * 100) / 100,
          bounceRate: Math.round(bounceRate * 100) / 100,
          spamRate: Math.round(spamRate * 100) / 100,
          unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
        },
        stats: stats.status === 'fulfilled' ? stats.value : [],
        ipReputation: ipReputation.status === 'fulfilled' ? ipReputation.value : [],
        accountInfo: accountInfo.status === 'fulfilled' ? accountInfo.value : null,
        recentSpamReports: spamReports.status === 'fulfilled' ? spamReports.value.slice(0, 10) : [],
        recentBounces: bounces.status === 'fulfilled' ? bounces.value.slice(0, 10) : [],
        recentUnsubscribes: unsubscribes.status === 'fulfilled' ? unsubscribes.value.slice(0, 10) : [],
        lastUpdated: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`Failed to get dashboard data: ${error.message}`);
      throw error;
    }
  }

  // 🎯 실시간 전송량 확인 (Rate Limit 모니터링)
  async getCurrentSendingRate(workspaceId: string) {
    try {
      await this.initializeClient(workspaceId);

      // 오늘의 통계 조회
      const today = new Date().toISOString().split('T')[0];
      const stats = await this.getStats(workspaceId, today);

      let todaysSent = 0;
      if (stats.length > 0) {
        stats.forEach(day => {
          day.stats.forEach(stat => {
            todaysSent += stat.metrics.requests || 0;
          });
        });
      }

      // 시간별 발송량 계산
      const currentHour = new Date().getHours();
      const averagePerHour = currentHour > 0 ? Math.round(todaysSent / currentHour) : todaysSent;

      return {
        todaysSent,
        averagePerHour,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`Failed to get current sending rate: ${error.message}`);
      throw error;
    }
  }
}