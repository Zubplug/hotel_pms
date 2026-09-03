const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const auditDate = new Date();
  auditDate.setHours(0,0,0,0);

  // Check for room charges posted today
  const charges = await prisma.folioItem.findMany({
      where: {
          createdAt: { gte: auditDate },
          description: { contains: 'Room Charge', mode: 'insensitive' }
      }
  });

  console.log(`Found ${charges.length} Room Charges posted today.`);
  
  // Check for No-Shows today
  const noShows = await prisma.reservation.findMany({
      where: {
          status: 'NO_SHOW',
          updatedAt: { gte: auditDate }
      }
  });

  console.log(`Found ${noShows.length} reservations marked as NO_SHOW today.`);

  if (charges.length > 0) {
      console.log('Sample charge:');
      console.log(charges[0]);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
