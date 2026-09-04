const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const eventId = '945d087e-eef3-4dd3-935c-0a2541baf24f';
  const aggregateId = 'a93229b6-9d31-4707-9aa3-3211041a2592';

  console.log("--- HotelEvent ---");
  const event = await prisma.hotelEvent.findUnique({ where: { id: eventId } });
  console.log(event);

  console.log("--- SyncConflict ---");
  const conflict = await prisma.syncConflict.findUnique({ where: { eventId } });
  console.log(conflict);

  console.log("--- Reservation ---");
  const res = await prisma.reservation.findUnique({ where: { id: aggregateId } });
  console.log(res);
  
  if (res) {
    console.log("--- LockOperations for Reservation ---");
    const lockOps = await prisma.lockOperation.findMany({ where: { reservationId: aggregateId } });
    console.log(lockOps);
  }
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
