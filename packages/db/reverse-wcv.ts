import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction(async (tx) => {
    const corp = await tx.corporateAccount.findFirst({
      where: { name: { contains: 'Worldwide Commercial', mode: 'insensitive' } },
      include: { cityLedgerAccount: true }
    });
    if (!corp || !corp.cityLedgerAccount) throw new Error("No account");
    
    const accountId = corp.cityLedgerAccount.id;
    const amount = 1044000;
    
    // Reverse the adjustment by creating a new entry and decrementing the balance
    await tx.cityLedgerEntry.create({
      data: {
        accountId,
        propertyId: corp.propertyId,
        amount,
        currency: 'NGN',
        type: 'ADJUSTMENT',
        status: 'OPEN',
        reference: 'REV-RECLASS-2026-09-15',
        reason: 'Reversed earlier reclassification to restore AR credit',
        createdBy: 'e277e79a-d037-4ceb-be94-2350b7d9a712', // System or original admin
      }
    });

    await tx.cityLedgerAccount.update({
      where: { id: accountId },
      data: { balance: { decrement: amount } } // Decrement makes it a credit
    });
    
    console.log("Successfully restored -1,044,000 NGN credit to WCV City Ledger.");
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
