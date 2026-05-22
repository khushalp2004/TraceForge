import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const active = await prisma.error.findMany({ where: { archivedAt: null } });
  const archived = await prisma.error.findMany({ where: { archivedAt: { not: null } } });
  console.log('Active:', active.length);
  console.log('Archived:', archived.length);
}
main();
