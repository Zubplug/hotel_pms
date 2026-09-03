import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const properties = await prisma.property.findMany();
  let fixedCount = 0;

  for (const property of properties) {
    const businessDateStr = property.businessDate.toISOString().split('T')[0];
    console.log(`Checking property ${property.id} (Business Date: ${businessDateStr})`);

    const reservedRooms = await prisma.room.findMany({
      where: {
        propertyId: property.id,
        status: 'RESERVED'
      }
    });

    for (const room of reservedRooms) {
      const activeReservations = await prisma.reservationRoom.findMany({
        where: {
          roomId: room.id,
          status: 'ACTIVE',
          reservation: {
            status: 'CONFIRMED'
          }
        }
      });

      let hasCurrentOrPastCheckIn = false;
      for (const rr of activeReservations) {
        const checkInStr = rr.checkIn.toISOString().split('T')[0];
        if (checkInStr <= businessDateStr) {
          hasCurrentOrPastCheckIn = true;
          break;
        }
      }

      if (!hasCurrentOrPastCheckIn) {
        console.log(`- Room ${room.number} (${room.id}) is RESERVED but has no active reservations for today or earlier. Reverting to AVAILABLE.`);
        await prisma.room.update({
          where: { id: room.id },
          data: { status: 'AVAILABLE' }
        });
        fixedCount++;
      }
    }
  }

  console.log(`Finished. Fixed ${fixedCount} rooms.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
