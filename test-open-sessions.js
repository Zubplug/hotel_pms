const { PrismaClient } = require('./packages/db');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst();
  const openSessions = await prisma.posSession.findMany({
    where: { propertyId: property.id, status: { in: ['OPEN', 'RECONCILIATION_REQUIRED'] } },
    select: { id: true, status: true, businessDate: true, openedBy: true }
  });
  console.log("Open sessions:", openSessions);

  // Check if any open orders belong to these open sessions
  for (const session of openSessions) {
      const orders = await prisma.posOrder.findMany({
          where: { sessionId: session.id, paymentStatus: { not: 'PAID' }, status: { notIn: ['VOIDED', 'CLOSED'] } },
          select: { id: true, orderNumber: true }
      });
      console.log(`Open orders for session ${session.id}:`, orders);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
