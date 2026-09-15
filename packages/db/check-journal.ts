import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const corp = await prisma.corporateAccount.findFirst({
    where: { code: 'WCV-LTD' },
    include: { cityLedgerAccount: true }
  });
  if (!corp) {
    console.log("No corp found");
    return;
  }
  const entries = await prisma.journalEntry.findMany({
    where: { 
      description: { contains: 'WCV', mode: 'insensitive' }
    },
    include: { lines: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Found ${entries.length} journal entries containing 'WCV'`);
  for (const entry of entries) {
    console.log(`Journal: ${entry.id} | Date: ${entry.createdAt} | Desc: ${entry.description}`);
    for (const line of entry.lines) {
      console.log(`  Line: ${line.accountCode} | Dr: ${line.debit} | Cr: ${line.credit}`);
    }
  }

  // Also check by reference or amount
  const entriesAmount = await prisma.journalEntry.findMany({
    where: { 
      lines: {
        some: {
          amount: 1044000
        }
      }
    },
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(`\nFound ${entriesAmount.length} journal entries for 1,044,000 amount`);
  for (const entry of entriesAmount) {
    console.log(`Journal: ${entry.id} | Date: ${entry.createdAt} | Desc: ${entry.description}`);
    for (const line of entry.lines) {
      console.log(`  Line: ${line.accountCode} | Dr: ${line.debit} | Cr: ${line.credit}`);
    }
  }

}
main().catch(console.error).finally(() => prisma.$disconnect());
