import { PrismaClient } from '@prisma/client';
import crypto from "crypto";

const hashPassword = async (password: string) => {
  return crypto.pbkdf2Sync(password, 'traceforge-salt', 100000, 64, 'sha512').toString('hex');
};

const prisma = new PrismaClient();

async function main() {
  // Create demo user
  const hashedPassword = await hashPassword('demo123');
  const user = await prisma.user.upsert({
    where: { email: 'demo@traceforge.com' },
    update: {},
    create: {
      email: 'demo@traceforge.com',
      passwordHash: hashedPassword,
    },
  });

  console.log(`Created user: ${user.email}`);

  // Create demo project
  const project = await prisma.project.create({
    data: {
      name: 'Demo Web App',
      apiKey: 'demo_' + Math.random().toString(36).substring(7),
      userId: user.id,
    },
  });

  console.log(`Created project: ${project.name} (API Key: ${project.apiKey})`);

  // Create demo organization
  const org = await prisma.organization.create({
    data: {
      name: 'Demo Team',
    },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  console.log(`Created org: ${org.name}`);

  // Create demo errors
  const demoErrors = [
    {
      message: 'Null pointer in checkout flow',
      stackTrace: 'at checkout.js:42\nat app.js:123',
      hash: 'error_001',
      projectId: project.id,
    },
    {
      message: 'Webhook timeout retries spike',
      stackTrace: 'at webhook.js:67\nat payments.js:89',
      hash: 'error_002',
      projectId: project.id,
    },
    {
      message: 'Cache miss storm after deploy',
      stackTrace: 'at cache.js:15\nat deploy.js:301',
      hash: 'error_003',
      projectId: project.id,
    },
  ];

  for (const errorData of demoErrors) {
    await prisma.error.upsert({
      where: { projectId_hash: { projectId: errorData.projectId, hash: errorData.hash } },
      update: {},
      create: errorData,
    });
    console.log(`Created error: ${errorData.message}`);
  }

  // Create some events
  await prisma.errorEvent.createMany({
    data: demoErrors.flatMap(errorData => [
      { errorId: 'error_001_id_placeholder', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) }, // 2h ago
      { errorId: 'error_001_id_placeholder', timestamp: new Date(Date.now() - 1000 * 60 * 10) }, // 10min ago
    ]),
  });

  console.log('Demo data seeded! Login: demo@traceforge.com / demo123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

