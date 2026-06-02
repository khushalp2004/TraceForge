const { PrismaClient } = require('./apps/backend/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const p = await prisma.githubRepoAnalysis.findFirst({ where: { status: 'READY' } });
  console.log("Type of folderTree:", typeof p.folderTree);
  console.log("Is array?", Array.isArray(p.folderTree));
  console.log("Length:", p.folderTree ? p.folderTree.length : null);
}
run().catch(console.error);
