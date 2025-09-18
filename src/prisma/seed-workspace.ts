import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creating workspace for Piehands CRM...');

  // 1. 워크스페이스 생성
  const workspace = await prisma.workspace.upsert({
    where: { id: 'ws_piehands' },
    update: {},
    create: {
      id: 'ws_piehands',
      name: 'Piehands Marketing Team',
    }
  });

  console.log('✅ Workspace created:', workspace);

  // 2. 테스트 사용자 몇 명 생성
  const testUsers = [
    {
      workspaceId: 'ws_piehands',
      distinctId: 'user_001',
      properties: {
        name: '홍길동',
        email: 'hong@example.com',
        level: 'VIP'
      },
      emailStatus: 'active' as const
    },
    {
      workspaceId: 'ws_piehands', 
      distinctId: 'user_002',
      properties: {
        name: '김철수',
        email: 'kim@example.com',
        level: 'Premium'
      },
      emailStatus: 'active' as const
    },
    {
      workspaceId: 'ws_piehands',
      distinctId: 'user_003', 
      properties: {
        name: '이영희',
        email: 'lee@example.com',
        level: 'Basic'
      },
      emailStatus: 'active' as const
    }
  ];

  for (const userData of testUsers) {
    await prisma.user.upsert({
      where: { 
        workspaceId_distinctId: { 
          workspaceId: userData.workspaceId, 
          distinctId: userData.distinctId 
        }
      },
      update: userData,
      create: userData
    });
  }

  console.log('✅ Created 3 test users');

  // 3. 테스트 템플릿 생성
  const testTemplate = await prisma.template.upsert({
    where: { id: 'tmpl_welcome' },
    update: {},
    create: {
      id: 'tmpl_welcome',
      workspaceId: 'ws_piehands',
      name: 'Welcome Email',
      type: 'EMAIL',
      contentType: 'HTML',
      content: {
        subject: 'Welcome {{user.name}}!',
        body_html: '<h1>Hello {{user.name}}!</h1><p>Welcome to our platform. Your level: {{user.level}}</p>'
      },
      createdBy: 'admin'
    }
  });

  console.log('✅ Template created:', testTemplate);

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
