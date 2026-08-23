const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestPayments = await prisma.posPayment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: {
      order: true
    }
  });
  console.log("Latest 3 Payments:", JSON.stringify(latestPayments, null, 2));

  const activeSessions = await prisma.posOperatorSession.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
    take: 3
  });
  console.log("Active POS Sessions:", JSON.stringify(activeSessions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
