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

  const orderIds = session.orders.map(o => o.id);
  const orderItemIds = session.orders.flatMap(o => o.items.map(i => i.id));
  
  console.log(`To delete:`);
  console.log(`- 1 POS Session`);
  console.log(`- ${orderIds.length} POS Orders`);
  console.log(`- ${orderItemIds.length} POS Order Items`);

  // Perform sequential deletion
  try {
    // 2.5 Production Batch Items
    if (orderItemIds.length > 0) {
      const deletedBatches = await prisma.posProductionBatchItem.deleteMany({ where: { orderItemId: { in: orderItemIds } } });
      console.log(`Deleted ${deletedBatches.count} Production Batch Items`);
    }

    // 3. Order Items
    if (orderIds.length > 0) {
      await prisma.posOrderItemModifier.deleteMany({ where: { orderItemId: { in: orderItemIds } } });
      const deletedItems = await prisma.posOrderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      console.log(`Deleted ${deletedItems.count} Order Items`);
    }

    // 4. Session Payments (direct)
    await prisma.posPayment.deleteMany({ where: { sessionId: sessionId } });
    console.log('Deleted direct Session Payments');

    // 5. Cash Movements
    await prisma.posCashMovement.deleteMany({ where: { sessionId: sessionId } });
    console.log('Deleted Cash Movements');

    // 6. Receipt / Auth / Control Audits
    await prisma.posReceiptAudit.deleteMany({ where: { sessionId: sessionId } });
    await prisma.posAuthorizationAudit.deleteMany({ where: { sessionId: sessionId } });
    await prisma.posControlAudit.deleteMany({ where: { sessionId: sessionId } });
    if (orderIds.length > 0) {
       await prisma.posReceiptAudit.deleteMany({ where: { orderId: { in: orderIds } } });
       await prisma.posAuthorizationAudit.deleteMany({ where: { orderId: { in: orderIds } } });
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
