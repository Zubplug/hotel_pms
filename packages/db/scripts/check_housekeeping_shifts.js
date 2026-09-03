const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0,0,0,0);

  const closedHk = await prisma.housekeepingShift.findMany({
      where: {
          status: 'CLOSED',
          closedAt: { gte: today }
      }
  });

  console.log(`Found ${closedHk.length} Housekeeping sessions closed today.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
