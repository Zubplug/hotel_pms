const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessionId = 'b2a94bb2-2c32-463d-8e28-82760b35c6bf'; // Esther Bassay's session

  const session = await prisma.posSession.findUnique({
    where: { id: sessionId },
    include: {
      orders: {
        include: {
          items: true,
          payments: true
        }
      },
      payments: true,
      cashMovements: true,
    }
  });

  if (!session) {
    console.log('Session not found.');
    return;
  }

  console.log(`Session: ${session.id}`);
  console.log(`Orders: ${session.orders.length}`);
  console.log(`Payments (direct on session): ${session.payments.length}`);
  console.log(`Cash Movements: ${session.cashMovements.length}`);
  
  let orderItemsCount = 0;
  let orderPaymentsCount = 0;
  for (const o of session.orders) {
    orderItemsCount += o.items.length;
    orderPaymentsCount += o.payments.length;
  }
  
  console.log(`Order Items: ${orderItemsCount}`);
  console.log(`Order Payments: ${orderPaymentsCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
