import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const corp = await prisma.corporateAccount.findFirst({
    where: { code: 'WCV-LTD' },
    include: { cityLedgerAccount: {
      include: {
        entries: { orderBy: { createdAt: 'asc' } },
        invoices: true
      }
    } }
  });
  if (!corp) {
    console.log("No corp found");
    return;
  }
  
  console.log(`--- ACCOUNT STATUS for ${corp.name} (${corp.code}) ---`);
  console.log(`Credit Limit: ${corp.creditLimit}`);
  if (corp.cityLedgerAccount) {
    console.log(`City Ledger Balance: ${corp.cityLedgerAccount.balance} (Negative means credit)`);
    console.log(`Open Invoices: ${corp.cityLedgerAccount.invoices.filter(i => i.status !== 'PAID').length}`);
    console.log(`\n--- CITY LEDGER ENTRIES ---`);
    for (const e of corp.cityLedgerAccount.entries) {
      console.log(`[${e.createdAt.toISOString()}] ${e.type} | Amount: ${e.amount} | Status: ${e.status} | Ref: ${e.reference}`);
      console.log(`   Reason: ${e.reason}`);
    }
  } else {
    console.log(`No City Ledger Account attached.`);
  }

  // Find journals related to the AR prepayments or WCV
  // The first migration was from a FolioCredit '9321ee8e-1718-4f5a-9518-b3bb4742e789'. Wait, that migration script did NOT create a Journal Entry.
  const journals = await prisma.journalEntry.findMany({
    where: { 
      description: { contains: 'WCV', mode: 'insensitive' }
    },
    include: { 
      lines: {
        include: { account: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\n--- GENERAL LEDGER JOURNALS (WCV) ---`);
  for (const j of journals) {
    console.log(`\nJournal [${j.entryNumber || j.id.slice(0,8)}] - ${j.createdAt.toISOString()}`);
    console.log(`Description: ${j.description}`);
    for (const line of j.lines) {
      const dr = Number(line.debit);
      const cr = Number(line.credit);
      const sign = dr > 0 ? `DR ${dr.toLocaleString()}` : `CR ${cr.toLocaleString()}`;
      console.log(`  => Account: ${line.account?.code} - ${line.account?.name} | ${sign}`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
