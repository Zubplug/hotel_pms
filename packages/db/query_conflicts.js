const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const latestConflicts = await prisma.syncConflict.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { hotelEvent: true }
  });
  
  console.log('Latest SyncConflicts:', JSON.stringify(latestConflicts, null, 2));

  // Also check if our specific event exists
  const event = await prisma.hotelEvent.findUnique({
    where: { id: '945d087e-eef3-4dd3-935c-0a2541baf24f' }
  });
  console.log('Specific Event exists?', !!event);
}

run().catch(console.error).finally(() => prisma.$disconnect());
