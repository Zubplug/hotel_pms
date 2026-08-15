import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.reservation.findFirst({
      orderBy: { checkIn: 'desc' },
      include: {
        reservationRooms: true,
        folios: { include: { items: { orderBy: { businessDate: 'asc' } } } }
      }
    });
    console.dir(res, { depth: null });
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
