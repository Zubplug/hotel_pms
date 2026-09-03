const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  // Find ALL active checked-in reservations
  const activeReservations = await prisma.reservation.findMany({
      where: {
          propertyId: property.id,
          status: 'CHECKED_IN'
      },
      include: {
          reservationRooms: { include: { room: true } }
      }
  });

  const resIds = activeReservations.map(r => r.id);
  const roomIds = [];
  
  activeReservations.forEach(r => {
      r.reservationRooms.forEach(rr => {
          if (rr.room) roomIds.push(rr.room.id);
      });
  });
  
  // Also push 1.3.309 which we want the desktop to clear
  const room309 = await prisma.room.findFirst({ where: { number: '1.3.309' } });
  if (room309) roomIds.push(room309.id);

  // Set them to +2 hours in the future to bypass the cursor that got stuck when I moved it 30 mins ahead earlier
  const futureDate = new Date(Date.now() + 120 * 60 * 1000); 

  await prisma.reservation.updateMany({
      where: { id: { in: resIds } },
      data: { updatedAt: futureDate }
  });

  await prisma.room.updateMany({
      where: { id: { in: roomIds } },
      data: { updatedAt: futureDate }
  });

  console.log(`✅ Bumped timestamps for ${resIds.length} reservations and ${roomIds.length} rooms to ${futureDate.toISOString()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
