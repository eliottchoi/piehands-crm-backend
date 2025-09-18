const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const workspaceId = 'ws_piehands';

  // Create a workspace only if it doesn't exist
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!existingWorkspace) {
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name: 'Default Workspace',
      },
    });
    console.log(`Workspace with id ${workspaceId} created.`);
  } else {
    console.log(`Workspace with id ${workspaceId} already exists.`);
  }

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
