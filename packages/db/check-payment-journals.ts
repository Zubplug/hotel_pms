import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const journals = await prisma.journalEntry.findMany({
    where: { 
      createdAt: { gte: new Date('2026-09-15T04:10:00Z') },
      description: { contains: 'Payment' }
    }
  });
  console.log(`Found ${journals.length} journal entries for payments today.`);
  for (const j of journals) {
    console.log(`  [${j.createdAt.toISOString()}] ${j.description} | Status: ${j.status}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
