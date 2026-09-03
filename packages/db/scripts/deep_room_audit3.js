const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const pid = property.id;
  const allRooms = await prisma.room.findMany({ where: { propertyId: pid } });
  const roomById = Object.fromEntries(allRooms.map(r => [r.id, r]));

  // ── 5. OUTBOX EVENTS ─────────────────────────────────────────────────────
  console.log('=== 5. OUTBOX EVENTS (pending/failed) ===');
  try {
    // Try the correct model name
    const models = Object.keys(prisma).filter(k => k.toLowerCase().includes('outbox') || k.toLowerCase().includes('event'));
    console.log('Available outbox-like models:', models);
    
    const outbox = await prisma.syncOutboxEvent.findMany({
      where: { propertyId: pid, status: { in: ['PENDING', 'FAILED', 'CONFLICT'] } },
      orderBy: { createdAt: 'desc' }, take: 15
    }).catch(() => null);

    if (outbox === null) {
      console.log('(outbox model name differs — skipping)');
    } else if (outbox.length === 0) {
      console.log('✅ No pending/failed outbox events.');
    } else {
      for (const e of outbox) {
        console.log(`  ⚠️  ${e.eventType} | Status: ${e.status} | ${e.aggregateType} | ${e.createdAt.toDateString()}`);
      }
    }
  } catch(err) {
    console.log(`Outbox check skipped: ${err.message}`);
  }

  // ── 6. LAUNDRY ORDERS (active) ───────────────────────────────────────────
  console.log('\n=== 6. LAUNDRY ORDERS (active) ===');
  const laundry = await prisma.laundryOrder.findMany({ where: { propertyId: pid, status: { not: 'DELIVERED' } } });
  if (laundry.length === 0) { console.log('✅ No active laundry orders.'); }
  else { for (const l of laundry) console.log(`  - ${l.id.slice(0,8)} | Status: ${l.status} | Room: ${roomById[l.roomId]?.number || l.roomId}`); }

  // ── 7. HK STATUS ─────────────────────────────────────────────────────────
  console.log('\n=== 7. ROOM HOUSEKEEPING STATUS ===');
  const notClean = allRooms.filter(r => !['CLEAN', 'AVAILABLE', null, undefined, ''].includes(r.housekeepingStatus));
  if (notClean.length === 0) { console.log('✅ All rooms have CLEAN/default housekeeping status.'); }
  else { for (const r of notClean) console.log(`  ⚠️  Room ${r.number} | HK: ${r.housekeepingStatus}`); }

  // ── 8. PAYMENTS CHECK ────────────────────────────────────────────────────
  console.log('\n=== 8. PAYMENTS LINKED TO CHECKED-IN RESERVATIONS ===');
  const checkedInRes = await prisma.reservation.findMany({
    where: { propertyId: pid, status: 'CHECKED_IN' },
    include: { primaryGuest: true, reservationRooms: { include: { room: true } } }
  });
  for (const res of checkedInRes) {
    const payments = await prisma.payment.findMany({
      where: { reservationId: res.id },
      select: { id: true, amount: true, method: true, frontdeskSessionId: true, status: true, createdAt: true }
    });
    const rooms = res.reservationRooms.map(rr => rr.room?.number).join(', ');
    console.log(`\n  Res ${res.confirmationNumber} | ${res.primaryGuest?.firstName} ${res.primaryGuest?.lastName} | Room ${rooms}:`);
    if (payments.length === 0) { console.log('    (no payments recorded)'); }
    for (const p of payments) {
      const linked = p.frontdeskSessionId ? '✅ shift linked' : '⚠️  NO SHIFT LINK';
      console.log(`    - ${p.method} ₦${p.amount} | ${p.status} | ${linked}`);
    }
  }

  // ── 9. CHECK RESERVATIONS DATES ─────────────────────────────────────────
  console.log('\n=== 9. CHECK-IN/OUT DATES VS BUSINESS DATE (Sep 1) ===');
  const businessDate = new Date('2026-09-01');
  for (const res of checkedInRes) {
    const checkIn = new Date(res.checkIn);
    const checkOut = new Date(res.checkOut);
    const rooms = res.reservationRooms.map(rr => rr.room?.number).join(', ');
    const checkInOk = checkIn >= businessDate;
    const icon = checkInOk ? '✅' : '⚠️ ';
    console.log(`  ${icon} ${res.confirmationNumber} | ${res.primaryGuest?.firstName} | Room ${rooms} | CheckIn: ${checkIn.toDateString()} → CheckOut: ${checkOut.toDateString()}`);
  }

  // ── 10. FRONTDESK SESSION STATUS ─────────────────────────────────────────
  console.log('\n=== 10. FRONTDESK SESSION STATUS ===');
  const sessions = await prisma.frontdeskSession.findMany({
    where: { propertyId: pid },
    include: { staff: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' }, take: 5
  });
  for (const s of sessions) {
    const staffName = `${s.staff?.firstName || ''} ${s.staff?.lastName || ''}`.trim();
    console.log(`  - ${s.shiftReference} | ${staffName} | Status: ${s.status} | Business Date: ${new Date(s.businessDate).toDateString()} | Opened: ${s.openedAt?.toDateString()}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
