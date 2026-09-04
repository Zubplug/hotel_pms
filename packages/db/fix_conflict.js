const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const eventId = '945d087e-eef3-4dd3-935c-0a2541baf24f';

  const conflict = await prisma.syncConflict.findFirst({
    where: { hotelEventId: eventId }
  });

  if (conflict) {
    console.log('Deleting SyncConflict:', conflict.id);
    await prisma.syncConflict.delete({ where: { id: conflict.id } });
  }

  const event = await prisma.hotelEvent.findUnique({
    where: { id: eventId }
  });

  if (event) {
    console.log('Deleting HotelEvent:', event.id);
    await prisma.hotelEvent.delete({ where: { id: event.id } });
  }

  console.log('Cleanup done!');
}

run().catch(console.error).finally(() => prisma.$disconnect());
