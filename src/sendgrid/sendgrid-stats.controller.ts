import { Controller, Get, Query, Param } from '@nestjs/common';
import { SendGridStatsService, SendGridStats, ReputationData, SendGridAccount } from './sendgrid-stats.service';

@Controller('sendgrid')
export class SendGridStatsController {
  constructor(private sendGridStatsService: SendGridStatsService) {}

  // 🎯 대시보드 전체 데이터
  @Get('dashboard/:workspaceId')
  async getDashboardData(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string
  ) {
    try {
      const daysNumber = days ? parseInt(days, 10) : 7;
      const data = await this.sendGridStatsService.getDashboardData(workspaceId, daysNumber);

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 🎯 통계 조회
  @Get('stats/:workspaceId')
  async getStats(
    @Param('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate?: string
  ) {
    try {
      if (!startDate) {
        return {
          success: false,
          message: 'startDate is required',
        };
      }

      const stats = await this.sendGridStatsService.getStats(workspaceId, startDate, endDate);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 🎯 IP 평판 조회
  @Get('reputation/:workspaceId')
  async getIPReputation(@Param('workspaceId') workspaceId: string) {
    try {
      const reputation = await this.sendGridStatsService.getIPReputation(workspaceId);

      return {
        success: true,
        data: reputation,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 🎯 계정 정보 조회
  @Get('account/:workspaceId')
  async getAccountInfo(@Param('workspaceId') workspaceId: string) {
    try {
      const accountInfo = await this.sendGridStatsService.getAccountInfo(workspaceId);

      return {
        success: true,
        data: accountInfo,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 🎯 스팸 신고 조회
  @Get('spam-reports/:workspaceId')
  async getSpamReports(
    @Param('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate?: string
  ) {
    try {
      if (!startDate) {
        return {
          success: false,
          message: 'startDate is required',
        };
      }

      const spamReports = await this.sendGridStatsService.getSpamReports(workspaceId, startDate, endDate);

      return {
        success: true,
        data: spamReports,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 🎯 반송 조회
  @Get('bounces/:workspaceId')
  async getBounces(
    @Param('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate?: string
  ) {
    try {
      if (!startDate) {
        return {
          success: false,
          message: 'startDate is required',
        };
      }

      const bounces = await this.sendGridStatsService.getBounces(workspaceId, startDate, endDate);

      return {
        success: true,
        data: bounces,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 🎯 수신 거부 조회
  @Get('unsubscribes/:workspaceId')
  async getUnsubscribes(
    @Param('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate?: string
  ) {
    try {
      if (!startDate) {
        return {
          success: false,
          message: 'startDate is required',
        };
      }

      const unsubscribes = await this.sendGridStatsService.getUnsubscribes(workspaceId, startDate, endDate);

      return {
        success: true,
        data: unsubscribes,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 🎯 실시간 전송량 조회
  @Get('sending-rate/:workspaceId')
  async getCurrentSendingRate(@Param('workspaceId') workspaceId: string) {
    try {
      const rate = await this.sendGridStatsService.getCurrentSendingRate(workspaceId);

      return {
        success: true,
        data: rate,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}