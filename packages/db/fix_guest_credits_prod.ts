import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function fix() {
  const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';
  const organizationId = 'd08a652f-344b-4749-8dd6-09e63cb9740e';
  const mrBulusGuestId = 'a93de66c-d758-4736-aa51-fe6fcd127566';
  const mrBulusFolioId = '966e273e-217d-485e-97cc-6b3278c11c64';
  const mrBulusResId = 'b4ea3a97-eae0-4758-b012-6eba902d1317';
  
  // 1. Delete the erroneous FolioCredit I created
  try {
    await prisma.folioCredit.delete({
      where: { idempotencyKey: 'BACKFILL-FOLIO-CREDIT-bulus-35k' }
    });
    console.log("Deleted erroneous FolioCredit.");
  } catch(e) {
    console.log("FolioCredit already deleted or not found.");
  }

  // 2. Find or create the REFUND_PAYABLE account for City Ledger
  let refundAccount = await prisma.cityLedgerAccount.findFirst({
    where: { propertyId, type: 'REFUND_PAYABLE', status: 'ACTIVE' }
  });

  if (!refundAccount) {
    refundAccount = await prisma.cityLedgerAccount.create({
      data: {
        organizationId,
        propertyId,
        name: 'Pending Guest Refunds',
        type: 'REFUND_PAYABLE',
        currency: 'NGN',
        balance: 0
      }
    });
    console.log("Created 'Pending Guest Refunds' City Ledger Account.");
  }

  // 3. Create the CityLedgerEntry for REFUND_OWED pointing to the correct account
  // Wait, let me check if we already have it.
  const existingEntry = await prisma.cityLedgerEntry.findFirst({
    where: { 
      propertyId,
      guestId: mrBulusGuestId,
      type: 'REFUND_OWED',
      amount: 35000,
      accountId: refundAccount.id
    }
  });

  if (!existingEntry) {
    await prisma.cityLedgerEntry.create({
      data: {
        accountId: refundAccount.id,
        propertyId,
        guestId: mrBulusGuestId,
        reservationId: mrBulusResId,
        folioId: mrBulusFolioId,
        amount: 35000,
        currency: 'NGN',
        type: 'REFUND_OWED',
        status: 'OPEN',
        reference: 'CR-RES-246836-988-966E273E',
        reason: 'Backfill 2026-09-18: Mr. Bulus overpaid ₦70,000 on ₦35,000 room charge. Credit ₦35,000 available for next stay.',
        createdBy: '292e4eff-4e12-4b64-a1c2-649c294cd6fc', // system admin
        createdAt: new Date('2026-09-17T00:36:49.000Z')
      }
    });
    console.log("Created REFUND_OWED CityLedgerEntry for Mr. Bulus.");

    // Update the account balance
    await prisma.cityLedgerAccount.update({
      where: { id: refundAccount.id },
      data: { balance: { increment: 35000 } }
    });
    console.log("Updated Pending Guest Refunds balance by 35,000.");
  } else {
    console.log("REFUND_OWED entry already exists on correct account.");
  }
}

fix().catch(console.error).finally(() => prisma.$disconnect());
