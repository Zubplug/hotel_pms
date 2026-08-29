import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const conflicts = await prisma.syncConflict.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.dir(conflicts, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());
