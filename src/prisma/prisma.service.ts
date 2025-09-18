import { Injectable, OnModuleInit, OnModuleDestroy, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const host = configService.get<string>('DB_HOST');
    const port = configService.get<number>('DB_PORT');
    const user = configService.get<string>('DB_USER');
    const password = configService.get<string>('DB_PASSWORD');
    const database = configService.get<string>('DB_NAME');
    
    if (!host || !port || !user || !password || !database) {
      throw new InternalServerErrorException('Database configuration is incomplete');
    }

    const schema = configService.get<string>('DB_SCHEMA', 'public');
    
    const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?schema=${schema}`;

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
