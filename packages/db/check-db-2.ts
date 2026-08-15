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
    console.log("Reservation snapshot:", res?.ratePlanSnapshot);
    console.log("Room rateAmount:", res?.reservationRooms[0]?.rateAmount);
    console.log("Folio items:", res?.folios[0]?.items.map(i => i.amount));
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
