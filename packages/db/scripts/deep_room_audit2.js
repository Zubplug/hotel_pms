const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const pid = property.id;

  const allRooms = await prisma.room.findMany({ where: { propertyId: pid } });
  const roomById = Object.fromEntries(allRooms.map(r => [r.id, r]));
  const roomByNumber = Object.fromEntries(allRooms.map(r => [r.number, r]));
  const keyRoomNumbers = ['1.1.104','1.1.105','1.2.204','1.2.209','1.3.309'];
  const keyRooms = keyRoomNumbers.map(n => roomByNumber[n]).filter(Boolean);

  // ── 3. FOLIO ASSIGNMENTS ──────────────────────────────────────────────────
  console.log('=== 3. FOLIO ASSIGNMENTS (checked-in reservations) ===');
  const checkedInRes = await prisma.reservation.findMany({
    where: { propertyId: pid, status: 'CHECKED_IN' },
    include: {
      primaryGuest: true,
      reservationRooms: { include: { room: true } },
      folios: { select: { id: true, folioNumber: true, type: true, totalCharges: true, totalPayments: true, balance: true, status: true } }
    }
  });
  for (const res of checkedInRes) {
    const rooms = res.reservationRooms.map(rr => rr.room?.number).join(', ');
    console.log(`\n  Res ${res.confirmationNumber} | ${res.primaryGuest?.firstName} ${res.primaryGuest?.lastName} | Rooms: ${rooms}`);
    for (const f of res.folios) {
      const outstanding = (f.totalCharges || 0) - (f.totalPayments || 0);
      console.log(`    Folio ${f.folioNumber} | Type: ${f.type} | Charges: ${f.totalCharges} | Payments: ${f.totalPayments} | Outstanding: ${outstanding} | Status: ${f.status}`);
    }
  }

  // ── 4. RESERVATION ROOM HISTORY ───────────────────────────────────────────
  console.log('\n=== 4. RESERVATION ROOM HISTORY (key rooms) ===');
  for (const room of keyRooms) {
    const history = await prisma.reservationRoom.findMany({
      where: { roomId: room.id },
      include: { reservation: { select: { confirmationNumber: true, status: true, checkIn: true, checkOut: true } } },
      orderBy: { createdAt: 'desc' }
    });
    const icon = history.filter(h => h.reservation.status === 'CHECKED_IN').length > 0 ? '🔴' : '🟢';
    console.log(`\n  ${icon} Room ${room.number} (${history.length} total reservation links):`);
    for (const h of history) {
      console.log(`    - ${h.reservation.confirmationNumber} | ${h.reservation.status} | ${h.reservation.checkIn?.toDateString()} → ${h.reservation.checkOut?.toDateString()}`);
    }
    if (history.length === 0) console.log('    ✅ No history.');
  }

  // ── 5. OUTBOX EVENTS (pending/failed) ────────────────────────────────────
  console.log('\n=== 5. OUTBOX EVENTS (pending/failed) ===');
  const outbox = await prisma.outboxEvent.findMany({
    where: { propertyId: pid, status: { in: ['PENDING', 'FAILED', 'CONFLICT'] } },
    orderBy: { createdAt: 'desc' }, take: 15
  });
  if (outbox.length === 0) { console.log('✅ No pending/failed outbox events.'); }
  else {
    for (const e of outbox) {
      console.log(`  ⚠️  ${e.eventType} | Status: ${e.status} | ${e.aggregateType} | ${e.createdAt.toDateString()}`);
    }
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
  for (const res of checkedInRes) {
    const payments = await prisma.payment.findMany({
      where: { reservationId: res.id },
      select: { id: true, amount: true, method: true, frontdeskSessionId: true, createdAt: true }
    });
    const rooms = res.reservationRooms.map(rr => rr.room?.number).join(', ');
    console.log(`\n  Res ${res.confirmationNumber} (Rooms: ${rooms}):`);
    if (payments.length === 0) { console.log('    (no payments yet)'); }
    for (const p of payments) {
      const linked = p.frontdeskSessionId ? '✅ linked to shift' : '⚠️ NO SHIFT LINK';
      console.log(`    - ${p.method} ₦${p.amount} | ${linked} | ${p.createdAt.toDateString()}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
