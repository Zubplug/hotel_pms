import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const journals = await prisma.journalEntry.findMany({
    where: { 
      description: { contains: 'WCV', mode: 'insensitive' }
    },
    include: { 
      lines: {
        include: { account: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  
  console.log("--- RECENT JOURNALS ---");
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
