import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Deleting seeded rooms...')
  
  // Find the building
  const building = await prisma.building.findFirst({
    where: { name: 'Main Wing' }
  });

  if (!building) {
    console.log('Main Wing not found');
    return;
  }

  // Delete all rooms in this building
  const deleteResult = await prisma.room.deleteMany({
    where: {
      buildingId: building.id
    }
  });

  console.log(`Deleted ${deleteResult.count} rooms.`);
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
