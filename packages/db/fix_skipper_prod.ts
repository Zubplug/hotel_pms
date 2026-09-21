import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function fix() {
  const accountId = 'dab945dc-58ac-496e-a673-3f4d2cbb0479';
  
  // Delete the wrong CityLedgerEntry
  try {
    await prisma.cityLedgerEntry.delete({
      where: { id: '28030ddc-eb4a-4fa8-86de-7de4002c4bba' }
    });
    console.log("Deleted erroneous entry");
  } catch (e) {
    console.log("Entry already deleted or not found");
  }

  // Adjust the balance of Skippers account back to 90,000
  const account = await prisma.cityLedgerAccount.findUnique({ where: { id: accountId } });
  if (Number(account?.balance) === 55000) {
    await prisma.cityLedgerAccount.update({
      where: { id: accountId },
      data: { balance: { increment: 35000 } }
    });
    console.log("Restored Skippers account balance to 90,000");
  } else {
    console.log(`Balance is ${account?.balance}, skipping balance update`);
  }

  // Create a FolioCredit for Mr. Bulus if not exists
  const existingCredit = await prisma.folioCredit.findUnique({
    where: { idempotencyKey: 'BACKFILL-FOLIO-CREDIT-bulus-35k' }
  });

  if (!existingCredit) {
    await prisma.folioCredit.create({
      data: {
        folioId: '966e273e-217d-485e-97cc-6b3278c11c64',
        reservationId: 'b4ea3a97-eae0-4758-b012-6eba902d1317',
        propertyId: '9b8a4229-4059-42f4-9565-51cfdbe79046',
        amount: 35000,
        remainingAmount: 35000,
        currency: 'NGN',
        method: 'POS',
        status: 'AVAILABLE',
        reference: 'CR-RES-246836-988-966E273E',
        notes: 'Guest overpayment of ₦70,000 on ₦35,000 room charge. Credit available for next stay.',
        receivedBy: '292e4eff-4e12-4b64-a1c2-649c294cd6fc',
        idempotencyKey: 'BACKFILL-FOLIO-CREDIT-bulus-35k',
        businessDate: new Date('2026-09-17T00:00:00Z')
      }
    });
    console.log("Created proper FolioCredit for Mr. Bulus.");
  } else {
    console.log("FolioCredit already exists.");
  }
}

fix().catch(console.error).finally(() => prisma.$disconnect());
