const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const pid = property.id;

  const sep1Start = new Date('2026-09-01T00:00:00.000Z');
  const sep1End   = new Date('2026-09-01T23:59:59.999Z');

  console.log('=== YESTERDAY (Sep 1, 2026) AUDIT ===\n');

  // 1. Frontdesk sessions opened Sep 1
  const sessions = await prisma.frontdeskSession.findMany({
    where: {
      propertyId: pid,
      OR: [
        { businessDate: { gte: sep1Start, lte: sep1End } },
        { openedAt: { gte: sep1Start, lte: sep1End } }
      ]
    },
    include: { staff: { select: { firstName: true, lastName: true } } }
  });
  console.log(`Frontdesk Sessions: ${sessions.length}`);
  for (const s of sessions) {
    console.log(`  - ${s.shiftReference} | ${s.staff?.firstName} ${s.staff?.lastName} | Status: ${s.status} | BizDate: ${new Date(s.businessDate).toDateString()} | Opened: ${s.openedAt?.toDateString()}`);
  }

  // 2. Payments created Sep 1
  const payments = await prisma.payment.findMany({
    where: { propertyId: pid, createdAt: { gte: sep1Start, lte: sep1End } },
    include: { reservation: { select: { confirmationNumber: true } } }
  });
  console.log(`\nPayments on Sep 1: ${payments.length}`);
  for (const p of payments) {
    console.log(`  - ${p.method} ₦${p.amount} | Res: ${p.reservation?.confirmationNumber} | ${p.createdAt.toISOString()}`);
  }

  // 3. Reservations checked in Sep 1
  const checkIns = await prisma.reservation.findMany({
    where: { propertyId: pid, checkIn: { gte: sep1Start, lte: sep1End } },
    include: { primaryGuest: true, reservationRooms: { include: { room: true } } }
  });
  console.log(`\nCheck-ins on Sep 1: ${checkIns.length}`);
  for (const r of checkIns) {
    const rooms = r.reservationRooms.map(rr => rr.room?.number).join(', ');
    console.log(`  - ${r.confirmationNumber} | ${r.primaryGuest?.firstName} ${r.primaryGuest?.lastName} | Room ${rooms} | Status: ${r.status}`);
  }

  // 4. Reservations checked out Sep 1
  const checkOuts = await prisma.reservation.findMany({
    where: { propertyId: pid, checkOut: { gte: sep1Start, lte: sep1End }, status: 'CHECKED_OUT' },
    include: { primaryGuest: true }
  });
  console.log(`\nCheck-outs on Sep 1: ${checkOuts.length}`);
  for (const r of checkOuts) {
    console.log(`  - ${r.confirmationNumber} | ${r.primaryGuest?.firstName} ${r.primaryGuest?.lastName}`);
  }

  // 5. FolioItems posted Sep 1
  const folioItems = await prisma.folioItem.findMany({
    where: { propertyId: pid, createdAt: { gte: sep1Start, lte: sep1End } }
  });
  console.log(`\nFolio items posted Sep 1: ${folioItems.length}`);
  for (const fi of folioItems) {
    console.log(`  - ${fi.description} | ₦${fi.amount} | ${fi.type}`);
  }

  // 6. Night audit for Sep 1
  const audit = await prisma.nightAudit.findFirst({
    where: { propertyId: pid, businessDate: { gte: sep1Start, lte: sep1End } }
  });
  console.log(`\nNight Audit for Sep 1: ${audit ? `${audit.status} (id: ${audit.id})` : 'None'}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
