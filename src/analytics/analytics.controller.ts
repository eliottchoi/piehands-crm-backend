import { Controller, Get, Query, Param } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // 🎯 전체 워크스페이스 이메일 활동 대시보드
  @Get('email-overview')
  async getEmailOverview(@Query('workspaceId') workspaceId: string) {
    return this.analyticsService.getEmailOverview(workspaceId);
  }

  // 🎯 특정 캠페인의 상세 분석
  @Get('campaigns/:campaignId')
  async getCampaignAnalytics(@Param('campaignId') campaignId: string) {
    return this.analyticsService.getCampaignAnalytics(campaignId);
  }

  // 🎯 특정 사용자의 이메일 히스토리
  @Get('users/:userId/email-history')
  async getUserEmailHistory(@Param('userId') userId: string) {
    return this.analyticsService.getUserEmailHistory(userId);
  }

  // 🎯 실시간 이메일 활동 피드
  @Get('recent-activities')
  async getRecentActivities(@Query('workspaceId') workspaceId: string, @Query('limit') limit: string = '50') {
    return this.analyticsService.getRecentEmailActivities(workspaceId, parseInt(limit));
  }
}
