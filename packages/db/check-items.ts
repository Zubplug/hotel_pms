import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.posOrderItem.findMany({
    where: { id: { in: ['b30110da-3e21-4d75-a6e2-4beffd30c574', 'c8dfdad9-425b-4370-a091-229ab3daafd5'] } }
  });
  console.dir(items);
}
main().catch(console.error).finally(() => prisma.$disconnect());
