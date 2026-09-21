import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const entries = await prisma.cityLedgerEntry.findMany({
    where: { type: 'REFUND_OWED' }
  });
  console.log("REFUND_OWED entries:", entries.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
