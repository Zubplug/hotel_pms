const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.reservation.findUnique({
      where: { confirmationNumber: 'RES-398161-618' },
      include: { reservationRooms: true }
  });
  
  if (res) {
      console.log(`Reservation ${res.confirmationNumber}`);
      console.log(`- Updated At: ${res.updatedAt}`);
      console.log(`- Rooms: ${res.reservationRooms.map(r => r.roomId).join(', ')}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
