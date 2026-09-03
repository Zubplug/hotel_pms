const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes in future to bypass clock skew

  const confirmationNumbers = ['RES-628759-3', 'RES-079991-826', 'RES-398161-618'];
  
  await prisma.reservation.updateMany({
      where: { confirmationNumber: { in: confirmationNumbers } },
      data: { updatedAt: futureDate }
  });

  const roomNumbers = ['1.1.104', '1.1.105', '1.2.209', '1.3.309'];
  await prisma.room.updateMany({
      where: { number: { in: roomNumbers } },
      data: { updatedAt: futureDate }
  });

  console.log(`✅ Bumped all updated timestamps to ${futureDate.toISOString()} to bypass any clock skew!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
