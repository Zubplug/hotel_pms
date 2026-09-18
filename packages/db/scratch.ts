import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const reservations = await prisma.reservation.findMany({
    where: {
      primaryGuest: {
        OR: [
          { firstName: { contains: 'Bulus', mode: 'insensitive' } },
          { lastName: { contains: 'Bulus', mode: 'insensitive' } }
        ]
      }
    },
    include: {
      primaryGuest: true,
      reservationRooms: { include: { room: true } },
      folios: { include: { payments: true } }
    }
  });

  console.log(JSON.stringify(reservations, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
