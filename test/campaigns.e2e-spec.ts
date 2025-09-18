import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { TemplateType, Workspace } from '@prisma/client';
import { execSync } from 'child_process';

describe('CampaignsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testWorkspace: Workspace;
  let testTemplateId: string;

  beforeAll(async () => {
    execSync('npx prisma migrate reset --force');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    prisma = app.get<PrismaService>(PrismaService);
    
    testWorkspace = await prisma.workspace.create({
      data: {
        id: 'ws_test',
        name: 'E2E Test Workspace',
      }
    });
    
    const template = await prisma.template.create({
      data: {
        workspaceId: testWorkspace.id,
        name: 'E2E Test Template',
        type: TemplateType.EMAIL,
        content: { subject: 'Test' },
        createdBy: 'e2e-test',
      }
    });
    testTemplateId = template.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/campaigns (POST)', () => {
    it('should create a new campaign in DRAFT status and return it', async () => {
      const campaignName = `E2E Test Campaign ${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post('/campaigns')
        .send({
          workspaceId: testWorkspace.id,
          name: campaignName,
          createdBy: 'e2e-test-user',
        })
        .expect(201);
      
      expect(response.body.name).toEqual(campaignName);
      expect(response.body.status).toEqual('DRAFT');
    });
  });

  describe('/campaigns/send (POST)', () => {
    it('should accept the request and return 202', () => {
      return request(app.getHttpServer())
        .post(`/campaigns/send?workspaceId=${testWorkspace.id}`)
        .send({
          templateId: testTemplateId,
          targetGroup: 'ALL_USERS',
        })
        .expect(202);
    });
  });
});
