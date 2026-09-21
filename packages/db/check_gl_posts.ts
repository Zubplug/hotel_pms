import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const journals = await prisma.journalEntry.findMany({
    where: { 
      reference: { in: ['BACKFILL-POS-PAY-bulus-9bb515e2', 'BACKFILL-CL-CR-bulus-966e273e'] } 
    },
    include: {
      lines: {
        include: {
          account: {
            select: { code: true, name: true }
          }
        }
      }
    }
  });
  
  if (journals.length === 0) {
    console.log("No journal entries found for Mr. Bulus backfill.");
    return;
  }

  for (const je of journals) {
    console.log(`\n=== Journal Entry: ${je.entryNumber} (${je.reference}) ===`);
    console.log(`Date: ${je.entryDate.toISOString().split('T')[0]} | Total Debit: ${je.totalDebit} | Total Credit: ${je.totalCredit} | Status: ${je.status}`);
    console.log(`Description: ${je.description}`);
    console.table(je.lines.map(line => ({
      Account: `${line.account.code} - ${line.account.name}`,
      Debit: line.debit,
      Credit: line.credit,
      Description: line.description
    })));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
