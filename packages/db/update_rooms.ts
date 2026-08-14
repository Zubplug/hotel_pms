import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all rooms...');
  const rooms = await prisma.room.findMany();
  
  let updatedCount = 0;
  
  for (const room of rooms) {
    // Skip if it already contains a dot (e.g., '1.3.310')
    if (room.number.includes('.')) {
      console.log(`Skipping room ${room.number} (already formatted)`);
      continue;
    }

    // Extract the first digit for the floor number (e.g. '3' from '310')
    const firstDigit = room.number.charAt(0);
    
    // Ensure the room number is a valid 3-digit number before renaming
    if (room.number.length >= 3 && !isNaN(parseInt(firstDigit))) {
      const newNumber = `1.${firstDigit}.${room.number}`;
      
      await prisma.room.update({
        where: { id: room.id },
        data: { number: newNumber }
      });
      
      console.log(`Renamed room ${room.number} -> ${newNumber}`);
      updatedCount++;
    } else {
      console.log(`Skipping room ${room.number} (unrecognized format)`);
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} rooms!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
