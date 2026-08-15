import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.reservation.findFirst({
      orderBy: { updatedAt: 'desc' },
      include: {
        reservationRooms: true,
        folios: { include: { items: { orderBy: { businessDate: 'asc' } } } }
      }
    });
    console.dir({
      id: res?.id,
      snapshot: res?.ratePlanSnapshot,
      roomRate: res?.reservationRooms[0]?.rateAmount,
      folioTotalCharges: res?.folios[0]?.totalCharges,
      folioBalance: res?.folios[0]?.balance,
      folioItemsAmounts: res?.folios[0]?.items.map(i => i.amount),
    }, { depth: null });
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
