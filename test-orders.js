const { PrismaClient } = require('./packages/db');
const prisma = new PrismaClient();

async function main() {
  const openOrders = await prisma.posOrder.findMany({
    where: {
      paymentStatus: { not: 'PAID' },
      status: { notIn: ['VOIDED', 'CLOSED'] },
    },
    select: {
      id: true,
      orderNumber: true,
      paymentStatus: true,
      status: true,
      sessionId: true,
      outlet: { select: { name: true } }
    }
  });
  console.log("Open orders:", openOrders);
}
main().catch(console.error).finally(() => prisma.$disconnect());
