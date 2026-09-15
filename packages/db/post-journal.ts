import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const reversalId = 'b228093e-ca7b-4871-9132-f650edf35651';
  
  await prisma.journalEntry.update({
    where: { id: reversalId },
    data: {
      status: 'POSTED',
      totalDebit: 1044000,
      totalCredit: 1044000
    }
  });
  console.log("Journal entry status updated to POSTED.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
