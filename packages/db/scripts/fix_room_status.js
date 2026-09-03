const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const pid = property.id;
  const businessDate = property.businessDate; // Sep 1

  console.log(`Business date: ${businessDate.toDateString()}`);

  // Get all rooms and what reservations are actually active RIGHT NOW
  const allRooms = await prisma.room.findMany({ where: { propertyId: pid } });
  const checkedInRes = await prisma.reservation.findMany({
    where: { propertyId: pid, status: 'CHECKED_IN' },
    include: { reservationRooms: { select: { roomId: true } } }
  });

  const occupiedRoomIds = new Set(
    checkedInRes.flatMap(r => r.reservationRooms.map(rr => rr.roomId))
  );

  console.log(`\nActually occupied rooms (by CHECKED_IN reservation): ${[...occupiedRoomIds].length}`);

  let fixed = 0;
  for (const room of allRooms) {
    const shouldBeOccupied = occupiedRoomIds.has(room.id);
    const currentStatus = room.status;

    if (shouldBeOccupied && currentStatus !== 'OCCUPIED') {
      await prisma.room.update({ where: { id: room.id }, data: { status: 'OCCUPIED', updatedAt: new Date() } });
      console.log(`✅ Room ${room.number}: ${currentStatus} → OCCUPIED`);
      fixed++;
    } else if (!shouldBeOccupied && currentStatus === 'OCCUPIED') {
      await prisma.room.update({ where: { id: room.id }, data: { status: 'AVAILABLE', updatedAt: new Date() } });
      console.log(`✅ Room ${room.number}: OCCUPIED → AVAILABLE`);
      fixed++;
    } else {
      console.log(`   Room ${room.number}: ${currentStatus} ✓ (already correct)`);
    }
  }

  console.log(`\n✅ Fixed ${fixed} room status records. All rooms now match actual occupancy.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
