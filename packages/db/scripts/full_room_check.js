const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });

  console.log('=== ALL ROOMS & THEIR STATUS ===');
  const allRooms = await prisma.room.findMany({
    where: { propertyId: property.id },
    orderBy: { number: 'asc' }
  });

  // Find all active reservations with their rooms
  const activeRes = await prisma.reservation.findMany({
    where: { propertyId: property.id, status: 'CHECKED_IN' },
    include: {
      reservationRooms: { include: { room: true } },
      primaryGuest: true
    }
  });

  // Build a map of roomId -> guest
  const occupiedMap = {};
  for (const res of activeRes) {
    for (const rr of res.reservationRooms) {
      if (rr.room) {
        occupiedMap[rr.room.id] = {
          guestName: `${res.primaryGuest?.firstName || ''} ${res.primaryGuest?.lastName || ''}`.trim(),
          confirmationNumber: res.confirmationNumber
        };
      }
    }
  }

  console.log('\n--- Expected occupied: 104, 105, 204, 209 | Available: 309 and others ---\n');

  let issues = 0;
  for (const room of allRooms) {
    const occupied = occupiedMap[room.id];
    const marker = occupied ? '🔴 OCCUPIED' : '🟢 AVAILABLE';
    console.log(`${marker} Room ${room.number} | HK: ${room.housekeepingStatus || 'N/A'} ${occupied ? `| Guest: ${occupied.guestName} (${occupied.confirmationNumber})` : ''}`);
    
    // Flag if 309 is still showing as occupied
    if (room.number === '1.3.309' && occupied) {
      console.log(`   ⚠️  ISSUE: Room 309 should NOT be occupied!`);
      issues++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total rooms: ${allRooms.length}`);
  console.log(`Occupied (by reservation): ${Object.keys(occupiedMap).length}`);
  console.log(`Issues found: ${issues}`);

  console.log(`\n=== RESERVATION ROOMS RAW CHECK ===`);
  // Double check - any reservationRoom pointing to 309?
  const room309 = allRooms.find(r => r.number === '1.3.309');
  if (room309) {
    const links = await prisma.reservationRoom.findMany({
      where: { roomId: room309.id },
      include: { reservation: { select: { confirmationNumber: true, status: true } } }
    });
    console.log(`Room 309 reservation links: ${links.length}`);
    for (const l of links) {
      console.log(`  - Res: ${l.reservation.confirmationNumber} | Status: ${l.reservation.status}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
