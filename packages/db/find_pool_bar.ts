import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const outlets = await prisma.posOutlet.findMany({
    where: {
      name: {
        contains: 'pol',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      name: true,
      property: { select: { name: true } }
    }
  });

  const outlets2 = await prisma.posOutlet.findMany({
    where: {
      name: {
        contains: 'pool',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      name: true,
      property: { select: { name: true } }
    }
  });

  console.log("Outlets (pol):", JSON.stringify(outlets, null, 2));
  console.log("Outlets (pool):", JSON.stringify(outlets2, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
