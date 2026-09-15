import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const payments = await prisma.payment.findMany({
    where: { 
      createdAt: { gte: new Date('2026-09-15T04:10:00Z') }
    },
    include: {
      CityLedgerEntry: true
    }
  });
  console.log(`Found ${payments.length} payments.`);
  for (const p of payments) {
    console.log(`Payment: ${p.amount} | Folio: ${p.folioId} | CityLedgerEntry length: ${p.CityLedgerEntry.length}`);
    for (const cle of p.CityLedgerEntry) {
      console.log(`  CLE: ${cle.id} | Account: ${cle.accountId} | Status: ${cle.status}`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
