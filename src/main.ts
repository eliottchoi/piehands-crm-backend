import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default JSON parser to handle raw body
  });

  // Keep the raw body for 'text/csv'
  app.use('/users/bulk', express.raw({ type: 'text/csv', limit: '10mb' }));

  // Use the JSON parser for all other routes
  app.use(express.json());

  app.enableCors({
    origin: 'http://localhost:5173', // Allow frontend origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // DTO에 정의되지 않은 속성은 자동으로 제거
    transform: true, // 들어오는 데이터를 DTO 타입으로 변환
  }));
  await app.listen(3000);
}
bootstrap();
