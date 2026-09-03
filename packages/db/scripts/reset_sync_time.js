const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  const confirmationNumbers = ['RES-628759-3', 'RES-079991-826', 'RES-398161-618'];
  await prisma.reservation.updateMany({
      where: { confirmationNumber: { in: confirmationNumbers } },
      data: { updatedAt: now }
  });

  const roomNumbers = ['1.1.104', '1.1.105', '1.2.209', '1.3.309'];
  await prisma.room.updateMany({
      where: { number: { in: roomNumbers } },
      data: { updatedAt: now }
  });

  console.log(`✅ Reset all updated timestamps back to current time: ${now.toISOString()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
