const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const reservationId = 'a93229b6-9d31-4707-9aa3-3211041a2592';
  const eventId = '945d087e-eef3-4dd3-935c-0a2541baf24f';

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });
  console.log('Reservation Version:', reservation?.version);
  console.log('Reservation Status:', reservation?.status);

  const syncConflict = await prisma.syncConflict.findFirst({
    where: { aggregateId: reservationId },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Latest SyncConflict:', syncConflict);

  const event = await prisma.hotelEvent.findUnique({
    where: { id: eventId }
  });
  console.log('Event:', event);
}

run().catch(console.error).finally(() => prisma.$disconnect());
