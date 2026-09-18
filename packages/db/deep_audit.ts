import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';
  const folioId = '966e273e-217d-485e-97cc-6b3278c11c64';
  const guestId = 'a93de66c-d758-4736-aa51-fe6fcd127566';
  const reservationId = 'b4ea3a97-eae0-4758-b012-6eba902d1317';

  console.log('\n========== 1. MR BULUS — FULL FOLIO STATE ==========');
  const folio = await prisma.folio.findUnique({ where: { id: folioId } });
  console.log(JSON.stringify(folio, null, 2));

  console.log('\n========== 2. ALL FOLIO ITEMS ==========');
  const items = await prisma.folioItem.findMany({ where: { folioId }, orderBy: { createdAt: 'asc' } });
  console.log(JSON.stringify(items, null, 2));

  console.log('\n========== 3. ALL PAYMENTS ON THIS FOLIO ==========');
  const payments = await prisma.payment.findMany({ where: { folioId }, orderBy: { createdAt: 'asc' } });
  console.log(JSON.stringify(payments, null, 2));

  console.log('\n========== 4. CITY LEDGER ENTRIES FOR THIS RESERVATION ==========');
  const clEntries = await prisma.cityLedgerEntry.findMany({
    where: { OR: [{ reservationId }, { guestId }] }
  });
  console.log(JSON.stringify(clEntries, null, 2));

  console.log('\n========== 5. EXISTING GL JOURNALS for this folio ==========');
  const journals = await prisma.journalEntry.findMany({
    where: {
      OR: [
        { lines: { some: { sourceId: folioId } } },
        { reference: { contains: 'bulus' } },
        { reference: { contains: '966e273e' } },
        { reference: { contains: '9bb515e2' } }
      ]
    },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } }
  });
  console.log(JSON.stringify(journals, null, 2));

  console.log('\n========== 6. SAMPLE — LAST 5 CHECKED-OUT RESERVATIONS (same property) ==========');
  const recentCheckouts = await prisma.reservation.findMany({
    where: { propertyId, status: 'CHECKED_OUT' },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: {
      primaryGuest: { select: { firstName: true, lastName: true } },
      folios: {
        select: {
          id: true, folioNumber: true, type: true, status: true,
          totalCharges: true, totalPayments: true, balance: true,
          payments: { select: { method: true, amount: true, status: true } },
        }
      }
    }
  });
  console.log(JSON.stringify(recentCheckouts, null, 2));

  console.log('\n========== 7. SAMPLE — FOLIOS WITH MISMATCH (totalPayments=0 but payments exist) ==========');
  // Find folios where totalPayments is 0 but there are linked payments 
  const suspectFolios = await prisma.folio.findMany({
    where: {
      propertyId,
      totalPayments: 0,
      payments: { some: { status: 'COMPLETED' } }
    },
    select: {
      id: true, folioNumber: true, totalCharges: true, totalPayments: true, balance: true,
      payments: { select: { amount: true, method: true, status: true, createdAt: true } }
    },
    take: 10
  });
  console.log('Folios with totalPayments=0 but COMPLETED payments:', JSON.stringify(suspectFolios, null, 2));

  console.log('\n========== 8. JOURNAL ENTRIES FOR A HEALTHY RECENT CHECKOUT (comparison) ==========');
  // Pick the most recent healthy checkout folio and show its journals
  const healthySample = recentCheckouts.find(r =>
    r.folios.some(f => Number(f.totalPayments) > 0)
  );
  if (healthySample) {
    const healthyFolioId = healthySample.folios[0]?.id;
    const healthyJournals = await prisma.journalEntry.findMany({
      where: { lines: { some: { sourceId: healthyFolioId } } },
      include: { lines: { include: { account: { select: { code: true, name: true } } } } }
    });
    console.log(`Healthy sample folio: ${healthyFolioId}`);
    console.log(JSON.stringify(healthyJournals, null, 2));
  }

  console.log('\n========== 9. CHECK JournalEntry TABLE for fixed UUIDs we plan to insert ==========');
  const existingFixed = await prisma.journalEntry.findMany({
    where: {
      id: { in: ['bf000001-b001-b001-b001-bf0000000001', 'bf000002-b002-b002-b002-bf0000000002'] }
    }
  });
  console.log('Pre-existing fixed UUID journals:', JSON.stringify(existingFixed, null, 2));

  console.log('\n========== 10. ACCOUNTING PERIOD CHECK ==========');
  const periods = await prisma.accountingPeriod.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(periods, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
