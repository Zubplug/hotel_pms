const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestPayments = await prisma.posPayment.findMany({
    where: { sessionId: null },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      order: true
    }
  });

  let updated = 0;
  for (const payment of latestPayments) {
    if (payment.order && payment.order.sessionId) {
      await prisma.posPayment.update({
        where: { id: payment.id },
        data: {
          sessionId: payment.order.sessionId,
          processedById: payment.order.serverStaffId
        }
      });
      updated++;
      console.log(`Updated payment ${payment.id} with sessionId ${payment.order.sessionId}`);
    }
  }

  console.log(`Successfully fixed ${updated} payments.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
