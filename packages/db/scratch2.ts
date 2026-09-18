import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';
  const guestId = 'a93de66c-d758-4736-aa51-fe6fcd127566';
  const reservationId = 'b4ea3a97-eae0-4758-b012-6eba902d1317';
  const folioId = '966e273e-217d-485e-97cc-6b3278c11c64';

  // 1. Check if a REFUND_OWED already exists for this folio/reservation
  const existingCredit = await prisma.cityLedgerEntry.findMany({
    where: {
      OR: [{ folioId }, { reservationId }],
      type: 'REFUND_OWED'
    }
  });
  console.log('=== Existing REFUND_OWED entries:', JSON.stringify(existingCredit, null, 2));

  // 2. Find available city ledger accounts for this property
  const accounts = await prisma.cityLedgerAccount.findMany({
    where: { propertyId },
    select: { id: true, name: true, type: true, balance: true, status: true }
  });
  console.log('=== City Ledger Accounts:', JSON.stringify(accounts, null, 2));

  // 3. Check folio items
  const folioItems = await prisma.folioItem.findMany({
    where: { folioId },
    orderBy: { createdAt: 'asc' }
  });
  console.log('=== Folio Items:', JSON.stringify(folioItems, null, 2));

  // 4. Check current folio state
  const folio = await prisma.folio.findUnique({
    where: { id: folioId }
  });
  console.log('=== Current Folio:', JSON.stringify(folio, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
