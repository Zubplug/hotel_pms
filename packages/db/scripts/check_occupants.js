const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  // Find all active checked-in reservations
  const activeReservations = await prisma.reservation.findMany({
      where: {
          propertyId: property.id,
          status: 'CHECKED_IN'
      },
      include: {
          reservationRooms: { include: { room: true } },
          primaryGuest: true
      }
  });

  console.log(`=== CHECKED IN RESERVATIONS IN DATABASE ===`);
  let roomsOccupied = [];
  for (const res of activeReservations) {
      const roomNumbers = res.reservationRooms.map(rr => rr.room?.number).filter(Boolean);
      roomsOccupied.push(...roomNumbers);
      console.log(`- Res: ${res.confirmationNumber} | Guest: ${res.primaryGuest?.firstName} ${res.primaryGuest?.lastName} | Rooms: ${roomNumbers.join(', ')}`);
  }
  
  console.log(`\nTotal Occupied Rooms in DB: ${roomsOccupied.join(', ')}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
