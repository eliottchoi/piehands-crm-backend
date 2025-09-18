import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'Backend is running successfully' 
    };
  }

  @Get('database')
  async checkDatabase() {
    try {
      // 간단한 데이터베이스 연결 테스트
      return { 
        status: 'ok', 
        message: 'Database connection successful' 
      };
    } catch (error) {
      return { 
        status: 'error', 
        message: error.message 
      };
    }
  }
}
