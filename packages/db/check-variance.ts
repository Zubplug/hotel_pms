import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const accounts = await prisma.cityLedgerAccount.findMany({
    include: {
      CorporateAccount: true,
      entries: { orderBy: { createdAt: 'desc' }, take: 10 }
    }
  });
  
  let totalActual = 0;
  for (const acc of accounts) {
    const corpName = acc.CorporateAccount[0]?.name || 'Unknown';
    console.log(`\nAccount: ${corpName} | Balance: ${acc.balance}`);
    totalActual += Number(acc.balance);
    for (const e of acc.entries) {
      console.log(`  [${e.createdAt.toISOString()}] ${e.type} | Amount: ${e.amount} | Status: ${e.status} | Ref: ${e.reference}`);
    }
  }
  console.log(`\nTOTAL ACTUAL CITY LEDGER BALANCE: ${totalActual}`);

  // Find payments
  const payments = await prisma.payment.findMany({
    where: { 
      createdAt: { gte: new Date('2026-09-15T00:00:00Z') }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`\nTODAY'S PAYMENTS:`);
  for (const p of payments) {
    console.log(`  [${p.createdAt.toISOString()}] ${p.method} | Amount: ${p.amount} | Source: ${p.sourceType} | FolioId: ${p.folioId}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
