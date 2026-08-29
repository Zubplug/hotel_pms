import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const kots = await prisma.posProductionBatch.findMany({
    where: { id: { in: ['d63c45c0-badf-4a7a-ac4c-f8cfa5c11b7e', '81b24831-9407-4a23-8910-a712935e3e36'] } }
  });
  console.dir(kots);
}
main().catch(console.error).finally(() => prisma.$disconnect());
