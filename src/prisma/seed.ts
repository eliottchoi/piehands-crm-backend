import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Clean up previous data
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.template.deleteMany(); // Add this line
  await prisma.workspace.deleteMany();
  console.log('Previous data cleaned up.');

  // 2. Create Workspace
  const workspace = await prisma.workspace.create({
    data: {
      id: 'ws_piehands',
      name: 'PieHands Internal - TikTok Creators',
    },
  });
  console.log(`Created workspace: ${workspace.name} (ID: ${workspace.id})`);

  // 3. Create TikTok Creator Users
  const creators = [
    // Identified User 1: Verified, highly active dancer
    {
      distinctId: 'creator__jennadance',
      properties: {
        email: 'jenna.d@example.com',
        name: 'Jenna Dance',
        tiktok_handle: '@jennadance',
        follower_count: 5200000,
        category: 'dance',
        country: 'US',
        is_verified: true,
        last_posted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    // Identified User 2: Micro-influencer, food category
    {
      distinctId: 'creator_mikeskitchen',
      properties: {
        email: 'mike.k@example.com',
        name: 'Mike Chen',
        tiktok_handle: '@mikeskitchen',
        follower_count: 85000,
        category: 'food',
        country: 'KR',
        is_verified: false,
        last_posted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    // Unidentified User: Comedy creator, recently inactive
    {
      distinctId: null,
      properties: {
        email: 'funnycarlos@example.com',
        name: 'Carlos Comedy',
        tiktok_handle: '@funnycarlos',
        follower_count: 1200000,
        category: 'comedy',
        country: 'MX',
        is_verified: true,
        last_posted_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    // Add 7 more creators
    ...Array.from({ length: 7 }, (_, i) => ({
      distinctId: `creator_user${i + 4}`,
      properties: {
        email: `creator${i + 4}@example.com`,
        name: `Creator ${i + 4}`,
        tiktok_handle: `@creator${i + 4}`,
        follower_count: Math.floor(Math.random() * 100000),
        category: ['tech', 'beauty', 'gaming'][i % 3],
        country: ['DE', 'JP', 'FR'][i % 3],
        is_verified: Math.random() > 0.8,
        last_posted_at: new Date(Date.now() - Math.floor(Math.random() * 15) * 24 * 60 * 60 * 1000).toISOString(),
      },
    })),
  ];

  const createdUsers = [];
  for (const creator of creators) {
    const user = await prisma.user.create({
      data: {
        workspaceId: workspace.id,
        distinctId: creator.distinctId,
        properties: creator.properties,
      },
    });
    createdUsers.push(user);
  }
  console.log(`Created ${createdUsers.length} TikTok creator users.`);

  // 4. Create realistic events for some creators
  // Jenna Dance's events
  await prisma.event.create({
    data: {
      userId: createdUsers[0].id,
      name: 'Uploaded Video',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      properties: { video_length_seconds: 15, sound_used: 'Viral Pop Song' },
    },
  });
  await prisma.event.create({
    data: {
      userId: createdUsers[0].id,
      name: 'Started Live Stream',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      properties: { stream_duration_minutes: 60, peak_viewers: 12000 },
    },
  });
  
  // Mike Chen's events
  await prisma.event.create({
    data: {
      userId: createdUsers[1].id,
      name: 'Gained Followers',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      properties: { new_followers_count: 500, source: 'featured_video' },
    },
  });
  await prisma.event.create({
    data: {
      userId: createdUsers[1].id,
      name: 'Received Comment',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      properties: { comment_length: 150, is_positive_sentiment: true },
    },
  });
  console.log('Created realistic events for creators.');


  // 5. Create Campaigns (same as before)
  await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: 'Welcome Email Series for New Creators',
      status: 'ACTIVE',
      createdBy: 'system',
    },
  });
  await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: 'Promote New Verification Badge Feature',
      status: 'DRAFT',
      createdBy: 'eliott@piehands.com',
    },
  });
  await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: 'Re-engage Inactive Creators',
      status: 'COMPLETED',
      createdBy: 'system',
    },
  });
  console.log('Created 3 campaigns.');

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
