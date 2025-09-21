import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  // 🎯 전체 워크스페이스 이메일 활동 대시보드 (실제 데이터)
  async getEmailOverview(workspaceId: string) {
    this.logger.log(`Getting email overview for workspace: ${workspaceId}`);

    try {
      // 🎯 워크스페이스의 모든 이메일 로그 조회
      const emailLogs = await this.prisma.emailLog.findMany({
        where: {
          user: {
            workspaceId: workspaceId
          }
        },
        include: {
          user: {
            select: {
              id: true,
              distinctId: true,
              properties: true,
              emailStatus: true
            }
          }
        },
        orderBy: { sentAt: 'desc' }
      });

      // 🎯 통계 계산
      const stats = {
        totalSent: emailLogs.length,
        totalDelivered: emailLogs.filter(log => log.status === 'delivered').length,
        totalOpened: emailLogs.filter(log => log.status === 'opened').length,
        totalClicked: emailLogs.filter(log => log.status === 'clicked').length,
        totalBounced: emailLogs.filter(log => log.status === 'bounced').length,
        totalUnsubscribed: emailLogs.filter(log => log.status === 'unsubscribed').length,
      };

      // 📈 비율 계산
      const deliveryRate = stats.totalSent > 0 ? (stats.totalDelivered / stats.totalSent * 100).toFixed(1) : '0';
      const openRate = stats.totalDelivered > 0 ? (stats.totalOpened / stats.totalDelivered * 100).toFixed(1) : '0';
      const clickRate = stats.totalDelivered > 0 ? (stats.totalClicked / stats.totalDelivered * 100).toFixed(1) : '0';
      const bounceRate = stats.totalSent > 0 ? (stats.totalBounced / stats.totalSent * 100).toFixed(1) : '0';

      // 🎯 최근 24시간 활동
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentEvents = await this.prisma.event.findMany({
        where: {
          user: {
            workspaceId: workspaceId
          },
          name: {
            in: ['email_sent', 'email_opened', 'email_clicked', 'email_bounced', 'email_unsubscribed']
          },
          timestamp: {
            gte: last24Hours
          }
        },
        include: {
          user: {
            select: {
              id: true,
              distinctId: true,
              properties: true,
              emailStatus: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      // 이벤트 형식 변환
      const formattedEvents = recentEvents.map(event => ({
        id: event.id,
        type: event.name,
        timestamp: event.timestamp.toISOString(),
        user: {
          name: (event.user.properties as any)?.name || 'Anonymous',
          email: (event.user.properties as any)?.email || '',
          distinctId: event.user.distinctId
        },
        properties: event.properties
      }));

      // 🚨 문제 사용자들 (bounced, unsubscribed)
      const problemUsers = await this.prisma.user.findMany({
        where: {
          workspaceId: workspaceId,
          emailStatus: {
            in: ['bounced', 'unsubscribed']
          }
        },
        select: {
          id: true,
          distinctId: true,
          properties: true,
          emailStatus: true,
          updatedAt: true
        },
        take: 20
      });

      const formattedProblemUsers = problemUsers.map(user => ({
        id: user.id,
        name: (user.properties as any)?.name || 'Anonymous',
        email: (user.properties as any)?.email || '',
        distinctId: user.distinctId,
        status: user.emailStatus as 'bounced' | 'unsubscribed',
        lastUpdated: user.updatedAt.toISOString()
      }));

      return {
        summary: {
          ...stats,
          deliveryRate: `${deliveryRate}%`,
          openRate: `${openRate}%`,
          clickRate: `${clickRate}%`,
          bounceRate: `${bounceRate}%`,
        },
        recentActivity: {
          last24Hours: recentEvents.length,
          events: formattedEvents
        },
        problemUsers: formattedProblemUsers
      };

    } catch (error) {
      this.logger.error(`Failed to get email overview: ${error.message}`);

      // 에러 시 빈 결과 반환
      return {
        summary: {
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          totalUnsubscribed: 0,
          deliveryRate: '0%',
          openRate: '0%',
          clickRate: '0%',
          bounceRate: '0%',
        },
        recentActivity: {
          last24Hours: 0,
          events: []
        },
        problemUsers: []
      };
    }
  }

  // 🎯 특정 캠페인의 상세 분석 (실제 데이터)
  async getCampaignAnalytics(campaignId: string) {
    this.logger.log(`Getting campaign analytics for: ${campaignId}`);

    try {
      // 🎯 캠페인의 실제 이메일 로그 조회
      const emailLogs = await this.prisma.emailLog.findMany({
        where: { campaignId },
        include: {
          user: {
            select: {
              id: true,
              distinctId: true,
              properties: true,
              emailStatus: true
            }
          }
        },
        orderBy: { sentAt: 'desc' }
      });

      // 🎯 상태별 통계 계산
      const stats = {
        totalSent: emailLogs.length,
        totalDelivered: emailLogs.filter(log => log.status === 'delivered').length,
        totalOpened: emailLogs.filter(log => log.status === 'opened').length,
        totalClicked: emailLogs.filter(log => log.status === 'clicked').length,
        totalBounced: emailLogs.filter(log => log.status === 'bounced').length,
        totalUnsubscribed: emailLogs.filter(log => log.status === 'unsubscribed').length,
      };

      // 📈 성과 지표 계산
      const performance = {
        deliveryRate: stats.totalSent > 0 ? ((stats.totalDelivered / stats.totalSent) * 100).toFixed(1) + '%' : '0%',
        openRate: stats.totalDelivered > 0 ? ((stats.totalOpened / stats.totalDelivered) * 100).toFixed(1) + '%' : '0%',
        clickRate: stats.totalDelivered > 0 ? ((stats.totalClicked / stats.totalDelivered) * 100).toFixed(1) + '%' : '0%',
        bounceRate: stats.totalSent > 0 ? ((stats.totalBounced / stats.totalSent) * 100).toFixed(1) + '%' : '0%',
      };

      // 📋 상세 로그 변환
      const logs = emailLogs.map(log => ({
        id: log.id,
        type: `email_${log.status}`,
        timestamp: log.sentAt.toISOString(),
        user: {
          id: log.user.id,
          name: (log.user.properties as any)?.name || 'Anonymous',
          email: log.toEmail,
          distinctId: log.user.distinctId,
          emailStatus: log.user.emailStatus
        },
        details: {
          campaign_id: campaignId,
          subject: log.subject,
          sendgrid_message_id: log.sendgridMessageId,
          error_message: log.errorMessage
        }
      }));

      // 🎯 캠페인 관련 이벤트도 조회 (열림, 클릭 등)
      const campaignEvents = await this.prisma.event.findMany({
        where: {
          name: {
            in: ['email_opened', 'email_clicked', 'email_bounced', 'email_unsubscribed']
          },
          properties: {
            path: ['campaign_id'],
            equals: campaignId
          }
        },
        include: {
          user: {
            select: {
              id: true,
              distinctId: true,
              properties: true,
              emailStatus: true
            }
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      // 이벤트 로그도 추가
      const eventLogs = campaignEvents.map(event => ({
        id: event.id,
        type: event.name,
        timestamp: event.timestamp.toISOString(),
        user: {
          id: event.user.id,
          name: (event.user.properties as any)?.name || 'Anonymous',
          email: (event.user.properties as any)?.email || '',
          distinctId: event.user.distinctId,
          emailStatus: event.user.emailStatus
        },
        details: event.properties
      }));

      // 로그 합치고 시간순 정렬
      const allLogs = [...logs, ...eventLogs].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return {
        campaignId,
        stats,
        performance,
        totalEvents: allLogs.length,
        logs: allLogs
      };

    } catch (error) {
      this.logger.error(`Failed to get campaign analytics: ${error.message}`);

      // 에러 시 빈 결과 반환
      return {
        campaignId,
        stats: {
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          totalUnsubscribed: 0,
        },
        performance: {
          deliveryRate: '0%',
          openRate: '0%',
          clickRate: '0%',
          bounceRate: '0%',
        },
        totalEvents: 0,
        logs: []
      };
    }
  }

  // 🎯 특정 사용자의 이메일 히스토리 (시뮬레이션)
  async getUserEmailHistory(userId: string) {
    this.logger.log(`Getting email history for user: ${userId}`);

    // 🎯 시뮬레이션 데이터
    const mockUserStats = {
      totalReceived: 15,
      totalOpened: 12,
      totalClicked: 4,
      totalBounced: 0,
      engagementRate: 80
    };

    const mockTimeline = [
      {
        id: '1',
        type: 'email_opened',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        details: { campaign_name: 'Welcome Series' }
      },
      {
        id: '2',
        type: 'email_sent',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        details: { campaign_name: 'Weekly Newsletter' }
      }
    ];

    return {
      userId,
      stats: mockUserStats,
      timeline: mockTimeline
    };
  }

  // 🎯 실시간 이메일 활동 피드 (시뮬레이션)
  async getRecentEmailActivities(workspaceId: string, limit: number = 50) {
    this.logger.log(`Getting recent activities for workspace: ${workspaceId}`);

    // 🎯 시뮬레이션 실시간 피드
    const mockActivities = [
      {
        id: '1',
        type: 'email_opened',
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        user: {
          id: 'user_001',
          name: '홍길동',
          email: 'hong@example.com',
          distinctId: 'user_001',
          emailStatus: 'active'
        },
        details: { campaign_name: 'Q4 Promotion' },
        message: '📧 홍길동이 Q4 Promotion 이메일을 열었습니다.'
      },
      {
        id: '2',
        type: 'email_clicked',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        user: {
          id: 'user_002',
          name: '김철수',
          email: 'kim@example.com',
          distinctId: 'user_002',
          emailStatus: 'active'
        },
        details: { campaign_name: 'Welcome Series', clicked_url: 'https://piehands.com' },
        message: '🔗 김철수가 Welcome Series 이메일의 링크를 클릭했습니다.'
      },
      {
        id: '3',
        type: 'email_bounced',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        user: {
          id: 'user_003',
          name: '박민수',
          email: 'invalid@baddomain.com',
          distinctId: 'user_003',
          emailStatus: 'bounced'
        },
        details: { campaign_name: 'Newsletter', bounce_reason: 'Invalid email address' },
        message: '❌ 박민수에게 발송한 Newsletter 이메일이 반송되었습니다.'
      }
    ];

    return mockActivities.slice(0, limit);
  }

  // 🎯 Helper: 이벤트 메시지 생성
  private getEventMessage(eventName: string, user: any, properties: any): string {
    const userName = (user.properties as any)?.name || user.distinctId || 'Anonymous';
    const campaignName = properties?.campaign_name || 'Unknown Campaign';

    switch (eventName) {
      case 'email_sent':
        return `📧 ${userName}에게 "${campaignName}" 이메일을 발송했습니다.`;
      case 'email_delivered':
        return `✅ ${userName}이 이메일을 수신했습니다.`;
      case 'email_opened':
        return `👀 ${userName}이 이메일을 열었습니다.`;
      case 'email_clicked':
        return `🔗 ${userName}이 이메일의 링크를 클릭했습니다.`;
      case 'email_bounced':
        return `❌ ${userName}에게 발송한 이메일이 반송되었습니다.`;
      case 'email_unsubscribed':
        return `🚫 ${userName}이 이메일 수신을 거부했습니다.`;
      default:
        return `📬 ${userName}에게 이메일 이벤트가 발생했습니다.`;
    }
  }
}