import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.reservationRoom.findMany();
  for (const room of rooms) {
    const newCheckIn = new Date(room.checkIn);
    newCheckIn.setDate(newCheckIn.getDate() + 1);
    
    const newCheckOut = new Date(room.checkOut);
    newCheckOut.setDate(newCheckOut.getDate() + 1);
    
    await prisma.reservationRoom.update({
      where: { id: room.id },
      data: { checkIn: newCheckIn, checkOut: newCheckOut }
    });
  }
  console.log('Fixed dates for reservations!');
}

main().finally(() => prisma.$disconnect());
