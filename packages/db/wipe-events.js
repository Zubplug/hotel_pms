require('dotenv').config({ path: 'packages/db/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '&connect_timeout=30'
    }
  }
});

async function main() {
  const eventIds = [
    'e84731c6-7fc8-47c3-a9af-65e49509cb88', // ADVANCE DEPOSIT
    '945d087e-eef3-4dd3-935c-0a2541baf24f'  // KEYCARD ENCODE
  ];

  console.log("Connecting to database to wipe events...");

  for (const id of eventIds) {
    try {
      console.log(`Checking SyncConflict for Event ID: ${id}`);
      await prisma.syncConflict.deleteMany({
        where: { hotelEventId: id }
      });
      console.log(`Deleted SyncConflict for ${id} (if existed)`);
      
      console.log(`Checking HotelEvent for ID: ${id}`);
      await prisma.hotelEvent.deleteMany({
        where: { id: id }
      });
      console.log(`Deleted HotelEvent for ${id} (if existed)`);
    } catch (err) {
      console.error(`Error deleting ${id}:`, err.message);
    }
  }
  
  console.log("Wipe complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
