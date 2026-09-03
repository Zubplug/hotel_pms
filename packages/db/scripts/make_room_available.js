const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const roomNumber = '1.3.309';
  const confirmationNumber = 'RES-398161-618';

  const room = await prisma.room.findFirst({ where: { number: roomNumber } });
  if (!room) {
      console.log(`Room ${roomNumber} not found.`);
      return;
  }

  const res = await prisma.reservation.findUnique({ where: { confirmationNumber } });
  if (!res) {
      console.log(`Reservation ${confirmationNumber} not found.`);
      return;
  }

  // Find the link
  const resRoom = await prisma.reservationRoom.findFirst({
      where: {
          roomId: room.id,
          reservationId: res.id
      }
  });

  if (resRoom) {
      await prisma.reservationRoom.delete({
          where: { id: resRoom.id }
      });
      console.log(`✅ Removed Room ${roomNumber} from Reservation ${confirmationNumber}`);
      
      // Touch the room and reservation to trigger sync
      await prisma.room.update({
          where: { id: room.id },
          data: { updatedAt: new Date() } // also could set housekeepingStatus: 'CLEAN' if needed, but removing the link frees it
      });
      await prisma.reservation.update({
          where: { id: res.id },
          data: { updatedAt: new Date() }
      });
      console.log(`✅ Touched Room ${roomNumber} and Reservation ${confirmationNumber} for desktop sync.`);
  } else {
      console.log(`Room ${roomNumber} is not linked to Reservation ${confirmationNumber}.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
