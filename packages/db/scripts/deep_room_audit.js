const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const pid = property.id;

  // Known occupied rooms
  const occupiedNumbers = ['1.1.104','1.1.105','1.2.204','1.2.209'];
  const shouldBeAvailable = ['1.3.309'];

  const allRooms = await prisma.room.findMany({ where: { propertyId: pid } });
  const roomByNumber = Object.fromEntries(allRooms.map(r => [r.number, r]));
  const roomById = Object.fromEntries(allRooms.map(r => [r.id, r]));

  const room309 = roomByNumber['1.3.309'];
  const room104 = roomByNumber['1.1.104'];
  const room105 = roomByNumber['1.1.105'];
  const room204 = roomByNumber['1.2.204'];
  const room209 = roomByNumber['1.2.209'];
  const keyRooms = [room104, room105, room204, room209, room309];

  console.log('=== 1. HOUSEKEEPING TASKS ===');
  const hkTasks = await prisma.housekeepingTask.findMany({
    where: { propertyId: pid },
    orderBy: { createdAt: 'desc' }
  });
  if (hkTasks.length === 0) {
    console.log('✅ No housekeeping tasks found.');
  } else {
    for (const t of hkTasks) {
      const room = roomById[t.roomId];
      console.log(`  - Room ${room?.number || t.roomId} | Type: ${t.taskType} | Status: ${t.status} | Created: ${t.createdAt.toDateString()}`);
    }
  }

  console.log('\n=== 2. MAINTENANCE TICKETS ===');
  const tickets = await prisma.maintenanceTicket.findMany({
    where: { propertyId: pid, status: { not: 'CLOSED' } },
    orderBy: { createdAt: 'desc' }
  });
  if (tickets.length === 0) {
    console.log('✅ No open maintenance tickets.');
  } else {
    for (const t of tickets) {
      const room = roomById[t.roomId];
      console.log(`  - Room ${room?.number || t.roomId} | Issue: ${t.issueType} | Status: ${t.status}`);
    }
  }

  console.log('\n=== 3. FOLIO ASSIGNMENTS (key rooms) ===');
  const resIds = (await prisma.reservation.findMany({
    where: { propertyId: pid, status: 'CHECKED_IN' },
    select: { id: true, confirmationNumber: true }
  }));
  for (const res of resIds) {
    const folios = await prisma.folio.findMany({
      where: { reservationId: res.id },
      select: { id: true, folioNumber: true, type: true, netBalance: true, status: true }
    });
    for (const f of folios) {
      console.log(`  Res ${res.confirmationNumber} → Folio ${f.folioNumber} | Type: ${f.type} | Balance: ${f.netBalance} | Status: ${f.status}`);
    }
  }

  console.log('\n=== 4. ROOM RESERVATION HISTORY (all statuses for key rooms) ===');
  for (const room of [room104, room105, room204, room209, room309]) {
    if (!room) continue;
    const history = await prisma.reservationRoom.findMany({
      where: { roomId: room.id },
      include: { reservation: { select: { confirmationNumber: true, status: true, checkIn: true, checkOut: true } } },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`\n  Room ${room.number}:`);
    if (history.length === 0) {
      console.log(`    ✅ No reservation history.`);
    } else {
      for (const h of history) {
        console.log(`    - Res: ${h.reservation.confirmationNumber} | Status: ${h.reservation.status} | CheckIn: ${h.reservation.checkIn?.toDateString()} | CheckOut: ${h.reservation.checkOut?.toDateString()}`);
      }
    }
  }

  console.log('\n=== 5. OUTBOX EVENTS (pending/failed) ===');
  const outbox = await prisma.outboxEvent.findMany({
    where: { propertyId: pid, status: { in: ['PENDING', 'FAILED', 'CONFLICT'] } },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  if (outbox.length === 0) {
    console.log('✅ No pending/failed outbox events.');
  } else {
    for (const e of outbox) {
      console.log(`  - ${e.eventType} | Status: ${e.status} | Aggregate: ${e.aggregateType}:${e.aggregateId?.slice(0,8)} | ${e.createdAt.toDateString()}`);
    }
  }

  console.log('\n=== 6. LAUNDRY ORDERS (active) ===');
  const laundry = await prisma.laundryOrder.findMany({
    where: { propertyId: pid, status: { not: 'DELIVERED' } }
  });
  if (laundry.length === 0) {
    console.log('✅ No active laundry orders.');
  } else {
    for (const l of laundry) {
      console.log(`  - Order ${l.id.slice(0,8)} | Status: ${l.status} | Room: ${l.roomId}`);
    }
  }

  console.log('\n=== 7. ROOM HOUSEKEEPING STATUS ===');
  const dirtyOrOccupied = allRooms.filter(r => !['CLEAN', 'AVAILABLE'].includes(r.housekeepingStatus || 'CLEAN'));
  if (dirtyOrOccupied.length === 0) {
    console.log('✅ All rooms have CLEAN housekeeping status.');
  } else {
    for (const r of dirtyOrOccupied) {
      console.log(`  ⚠️  Room ${r.number} | HK Status: ${r.housekeepingStatus}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
