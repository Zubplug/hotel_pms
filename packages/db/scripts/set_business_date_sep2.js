const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });

  // Sep 2 is the actual first operational day — all check-ins are Sep 2
  const sep2 = new Date('2026-09-02T00:00:00.000Z');

  await prisma.property.update({
    where: { id: property.id },
    data: {
      businessDate: sep2,
      auditStatus: 'OPEN',
      updatedAt: new Date()
    }
  });

  const updated = await prisma.property.findUnique({ where: { id: property.id }, select: { businessDate: true, auditStatus: true } });
  console.log(`✅ Business date: ${updated.businessDate.toDateString()}`);
  console.log(`✅ Audit status: ${updated.auditStatus}`);

  // Now verify the audit wizard's activeRoomReservations query will work:
  // checkIn: { lte: Sep 2 } AND checkOut: { gt: Sep 2 }
  const activeRooms = await prisma.reservationRoom.findMany({
    where: {
      reservation: { propertyId: property.id, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
      status: 'ACTIVE',
      roomId: { not: null },
      checkIn: { lte: sep2 },
      checkOut: { gt: sep2 },
    },
    include: {
      room: { select: { number: true } },
      reservation: { select: { confirmationNumber: true, status: true } }
    }
  });

  console.log(`\n✅ Audit wizard will now see ${activeRooms.length} active room assignments for Sep 2:`);
  for (const rr of activeRooms) {
    console.log(`   - Room ${rr.room?.number} | ${rr.reservation.confirmationNumber} | ${rr.reservation.status}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
