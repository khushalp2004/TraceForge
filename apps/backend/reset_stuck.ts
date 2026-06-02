import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const res1 = await prisma.githubRepoAnalysis.updateMany({
    where: { status: 'PROCESSING' },
    data: { status: 'FAILED', lastError: 'Worker crashed during previous generation run.' }
  });
  
  const res2 = await prisma.githubRepoAnalysis.updateMany({
    where: { graphStatus: 'PROCESSING' },
    data: { graphStatus: 'FAILED', lastError: 'Worker crashed during previous generation run.' }
  });
  
  const res3 = await prisma.githubRepoAnalysis.updateMany({
    where: { systemDesignStatus: 'PROCESSING' },
    data: { systemDesignStatus: 'FAILED', lastError: 'Worker crashed during previous generation run.' }
  });

  console.log(`Reset ${res1.count} reports, ${res2.count} graphs, ${res3.count} system designs to FAILED.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
