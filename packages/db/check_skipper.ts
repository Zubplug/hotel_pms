import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const accountId = 'dab945dc-58ac-496e-a673-3f4d2cbb0479';
  
  const entries = await prisma.cityLedgerEntry.findMany({
    where: { accountId },
    select: { id: true, type: true, amount: true, status: true, reference: true, reason: true, createdAt: true }
  });
  console.log("\n--- ENTRIES ---");
  console.table(entries);
}

main().catch(console.error).finally(() => prisma.$disconnect());
