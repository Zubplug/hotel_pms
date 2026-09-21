import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const credits = await prisma.folioCredit.findMany({
    where: { remainingAmount: { gt: 0 } },
    include: {
      folio: {
        include: {
          reservation: {
            include: { guest: true }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(credits, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
