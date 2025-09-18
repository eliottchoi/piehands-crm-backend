import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  // 🎯 전체 워크스페이스 이메일 활동 대시보드 (시뮬레이션)
  async getEmailOverview(workspaceId: string) {
    this.logger.log(`Getting email overview for workspace: ${workspaceId}`);

    // 🎯 임시 시뮬레이션 데이터 (UI 테스트용)
    const mockStats = {
      totalSent: 1250,
      totalDelivered: 1198,
      totalOpened: 856,
      totalClicked: 234,
      totalBounced: 52,
      totalUnsubscribed: 18,
    };

    // 📈 비율 계산
    const deliveryRate = (mockStats.totalDelivered / mockStats.totalSent * 100).toFixed(1);
    const openRate = (mockStats.totalOpened / mockStats.totalDelivered * 100).toFixed(1);
    const clickRate = (mockStats.totalClicked / mockStats.totalDelivered * 100).toFixed(1);
    const bounceRate = (mockStats.totalBounced / mockStats.totalSent * 100).toFixed(1);

    // 🎯 시뮬레이션 활동 피드
    const mockRecentEvents = [
      {
        id: '1',
        type: 'email_opened',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        user: { name: '홍길동', email: 'hong@example.com', distinctId: 'user_001' },
        properties: { campaign_name: 'Mock Campaign' }
      },
      {
        id: '2', 
        type: 'email_clicked',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        user: { name: '김철수', email: 'kim@example.com', distinctId: 'user_002' },
        properties: { campaign_name: 'Mock Campaign', clicked_url: 'https://example.com' }
      },
      {
        id: '3',
        type: 'email_sent',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        user: { name: '이영희', email: 'lee@example.com', distinctId: 'user_003' },
        properties: { campaign_name: 'Mock Campaign' }
      }
    ];

    // 🚨 시뮬레이션 문제 사용자들
    const mockProblemUsers = [
      {
        id: 'user_004',
        name: '박민수',
        email: 'invalid@badomain.com',
        distinctId: 'user_004',
        status: 'bounced' as const,
        lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }
    ];

    return {
      summary: {
        ...mockStats,
        deliveryRate: `${deliveryRate}%`,
        openRate: `${openRate}%`, 
        clickRate: `${clickRate}%`,
        bounceRate: `${bounceRate}%`,
      },
      recentActivity: {
        last24Hours: 45,
        events: mockRecentEvents
      },
      problemUsers: mockProblemUsers
    };
  }

  // 🎯 특정 캠페인의 상세 분석 (시뮬레이션)
  async getCampaignAnalytics(campaignId: string) {
    this.logger.log(`Getting campaign analytics for: ${campaignId}`);

    // 🎯 임시 시뮬레이션 데이터
    const mockStats = {
      totalSent: 150,
      totalDelivered: 145,
      totalOpened: 98,
      totalClicked: 23,
      totalBounced: 5,
      totalUnsubscribed: 2,
    };

    // 📈 성과 지표 계산
    const performance = {
      deliveryRate: ((mockStats.totalDelivered / mockStats.totalSent) * 100).toFixed(1) + '%',
      openRate: ((mockStats.totalOpened / mockStats.totalDelivered) * 100).toFixed(1) + '%',
      clickRate: ((mockStats.totalClicked / mockStats.totalDelivered) * 100).toFixed(1) + '%',
      bounceRate: ((mockStats.totalBounced / mockStats.totalSent) * 100).toFixed(1) + '%',
    };

    // 📋 시뮬레이션 상세 로그
    const mockLogs = [
      {
        id: '1',
        type: 'email_opened',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        user: {
          id: 'user_001',
          name: '홍길동',
          email: 'hong@example.com',
          distinctId: 'user_001',
          emailStatus: 'active'
        },
        details: { campaign_id: campaignId }
      },
      {
        id: '2',
        type: 'email_clicked',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        user: {
          id: 'user_002',
          name: '김철수',
          email: 'kim@example.com',
          distinctId: 'user_002',
          emailStatus: 'active'
        },
        details: { campaign_id: campaignId, clicked_url: 'https://example.com' }
      },
      {
        id: '3',
        type: 'email_bounced',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        user: {
          id: 'user_003',
          name: '박민수',
          email: 'invalid@baddomain.com',
          distinctId: 'user_003',
          emailStatus: 'bounced'
        },
        details: { campaign_id: campaignId, bounce_reason: 'Invalid email address' }
      }
    ];

    return {
      campaignId,
      stats: mockStats,
      performance,
      totalEvents: mockLogs.length,
      logs: mockLogs
    };
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