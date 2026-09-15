import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
const prisma = new PrismaClient();
async function main() {
  const journalId = '313d2aea-9c88-4153-a688-daef6c648f90';
  
  const original = await prisma.journalEntry.findUnique({
    where: { id: journalId },
    include: { lines: true }
  });
  
  if (!original) {
    console.log("Original journal not found");
    return;
  }
  
  console.log("Reversing journal:", original.description);
  
  // create reversal
  await prisma.$transaction(async (tx) => {
    const propertyId = original.propertyId;
    const year = new Date().getFullYear();
    const entryNumber = `JE-${propertyId.slice(0, 8).toUpperCase()}-${year}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
  
    const reversal = await tx.journalEntry.create({
      data: {
        propertyId: original.propertyId,
        businessDate: original.businessDate,
        entryDate: new Date(),
        entryNumber,
        reference: 'REV-' + (original.reference || journalId.slice(0, 8)),
        description: 'Reversal: ' + original.description,
        createdBy: 'e277e79a-d037-4ceb-be94-2350b7d9a712',
        lines: {
          create: original.lines.map(line => ({
            accountId: line.accountId,
            departmentId: line.departmentId,
            outletId: line.outletId,
            description: 'Reversal: ' + line.description,
            // Swap debit and credit
            debit: line.credit,
            credit: line.debit,
            sourceType: line.sourceType,
            sourceId: line.sourceId
          }))
        }
      },
      include: { lines: true }
    });
    
    console.log("Created Reversal Journal:", reversal.id);
    for (const line of reversal.lines) {
      console.log(`  Account ID: ${line.accountId} | Dr: ${line.debit} | Cr: ${line.credit}`);
    }
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
