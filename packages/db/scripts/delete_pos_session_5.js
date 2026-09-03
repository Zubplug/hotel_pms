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
    // 6. Receipt / Auth / Control Audits
    await prisma.posReceiptAudit.deleteMany({ where: { posSessionId: sessionId } });
    await prisma.posAuthorizationAudit.deleteMany({ where: { sessionId: sessionId } }); // this one error'd on posSessionId before
    await prisma.posControlAudit.deleteMany({ where: { sessionId: sessionId } });
    
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
    console.log('Trying alternative deletion due to field mismatches...');
    
    try {
      await prisma.$executeRaw`DELETE FROM "PosReceiptAudit" WHERE "posSessionId" = ${sessionId}`;
      await prisma.$executeRaw`DELETE FROM "PosAuthorizationAudit" WHERE "sessionId" = ${sessionId}`;
      await prisma.$executeRaw`DELETE FROM "PosControlAudit" WHERE "sessionId" = ${sessionId}`;
      
      if (orderIds.length > 0) {
        for (const oid of orderIds) {
           await prisma.$executeRaw`DELETE FROM "PosOrder" WHERE "id" = ${oid}`;
        }
      }
      
      await prisma.$executeRaw`DELETE FROM "PosSession" WHERE "id" = ${sessionId}`;
      console.log('\n✅ Successfully removed the shift and all its transactions (via raw SQL).');
    } catch (e2) {
      console.error('Raw SQL failed:', e2);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
