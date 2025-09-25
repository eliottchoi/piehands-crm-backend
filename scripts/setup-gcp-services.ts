#!/usr/bin/env ts-node

import { CloudTasksService } from '../src/tasks/cloud-tasks.service';
import { CloudSchedulerClient } from '@google-cloud/scheduler';

/**
 * GCP 서비스 설정 스크립트
 * - Cloud Tasks 큐 생성
 * - Cloud Scheduler 작업 생성 (IP Warm-up 일일 리셋)
 */

async function setupGCPServices() {
  console.log('🚀 Setting up GCP services...');

  try {
    // 1. Cloud Tasks 큐 생성
    console.log('📋 Creating Cloud Tasks queues...');
    const cloudTasksService = new CloudTasksService();
    await cloudTasksService.createQueues();

    // 2. Cloud Scheduler 설정
    console.log('⏰ Setting up Cloud Scheduler jobs...');
    await setupCloudScheduler();

    console.log('✅ GCP services setup completed successfully!');
  } catch (error) {
    console.error('❌ Failed to setup GCP services:', error);
    process.exit(1);
  }
}

async function setupCloudScheduler() {
  const client = new CloudSchedulerClient();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'agent-growth-and-ops';
  const location = process.env.GOOGLE_CLOUD_REGION || 'us-central1';
  const serviceUrl = process.env.NODE_ENV === 'production'
    ? 'https://crm-backend-310117686396.us-central1.run.app'
    : 'http://localhost:3000';

  // IP Warm-up 일일 리셋 작업 (매일 자정 UTC)
  const warmupResetJob = {
    name: client.jobPath(projectId, location, 'warmup-daily-reset'),
    description: 'Daily reset for IP warm-up counters - runs at midnight UTC',
    schedule: '0 0 * * *', // 매일 자정 UTC (cron 표현식)
    timeZone: 'UTC',
    httpTarget: {
      uri: `${serviceUrl}/tasks/reset-warmup`,
      httpMethod: 'POST' as const,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify({
        workspaceId: 'all', // 모든 워크스페이스에 적용
        date: new Date().toISOString().split('T')[0],
      })).toString('base64'),
    },
    retryConfig: {
      retryCount: 3,
      maxRetryDuration: { seconds: 600 }, // 10분
      minBackoffDuration: { seconds: 30 },
      maxBackoffDuration: { seconds: 300 },
    },
  };

  try {
    await client.createJob({
      parent: client.locationPath(projectId, location),
      job: warmupResetJob,
    });
    console.log('✅ Created warmup-daily-reset scheduler job');
  } catch (error) {
    if (error.code === 6) { // ALREADY_EXISTS
      console.log('ℹ️ warmup-daily-reset scheduler job already exists');

      // 기존 작업 업데이트
      try {
        await client.updateJob({
          job: warmupResetJob,
        });
        console.log('✅ Updated warmup-daily-reset scheduler job');
      } catch (updateError) {
        console.error('❌ Failed to update scheduler job:', updateError.message);
      }
    } else {
      console.error('❌ Failed to create scheduler job:', error.message);
    }
  }

  // 향후 확장: 캠페인별 스케줄링, 세분화된 warm-up 관리 등
  console.log('📝 Note: Additional scheduler jobs for campaign automation can be added here');
}

// 스크립트 실행
if (require.main === module) {
  setupGCPServices();
}

export { setupGCPServices };