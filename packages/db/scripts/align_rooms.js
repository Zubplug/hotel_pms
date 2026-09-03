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
          reservationRooms: {
              include: { room: true }
          }
      }
  });

  console.log(`Found ${activeReservations.length} checked-in reservations.`);

  const roomIdsToTouch = [];
  for (const res of activeReservations) {
      for (const resRoom of res.reservationRooms) {
          if (resRoom.room) {
              roomIdsToTouch.push(resRoom.room.id);
              console.log(`- Room ${resRoom.room.number} is occupied by Res ${res.confirmationNumber}`);
          }
      }
  }

  // Touch the rooms so the desktop sync picks them up
  if (roomIdsToTouch.length > 0) {
      await prisma.room.updateMany({
          where: { id: { in: roomIdsToTouch } },
          data: { updatedAt: new Date() }
      });
      console.log(`✅ Touched ${roomIdsToTouch.length} occupied rooms to force sync to desktop.`);
  } else {
      console.log("No occupied rooms found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
