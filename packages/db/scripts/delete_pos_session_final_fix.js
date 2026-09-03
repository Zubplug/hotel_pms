const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessionId = 'b2a94bb2-2c32-463d-8e28-82760b35c6bf'; // Esther Bassay's session

  const session = await prisma.posSession.findUnique({
    where: { id: sessionId },
    include: {
      orders: true
    }
  });

  if (!session) {
    console.log('Session not found or already deleted.');
    return;
  }

  const orderIds = session.orders.map(o => o.id);

  try {
    // 6.5 Production Batches (header)
    if (orderIds.length > 0) {
       await prisma.posProductionBatch.deleteMany({ where: { orderId: { in: orderIds } } });
       console.log('Deleted POS Production Batches');
    }
    
    // 7. Orders
    if (orderIds.length > 0) {
      await prisma.posOrder.deleteMany({ where: { id: { in: orderIds } } });
      console.log('Deleted POS Orders');
    }

    // 8. Session itself
    await prisma.posSession.delete({ where: { id: sessionId } });
    console.log('Deleted POS Session');
    
    console.log('\n✅ Successfully removed the shift and all its transactions.');

  } catch (error) {
    console.error('Error during deletion:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
