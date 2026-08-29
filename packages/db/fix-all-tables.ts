import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.posTable.findMany({
    where: { currentOrderId: { not: null } }
  });
  console.log(`Found ${tables.length} occupied tables.`);
  
  let cleared = 0;
  for (const table of tables) {
    const order = await prisma.posOrder.findUnique({
      where: { id: table.currentOrderId! }
    });
    
    // If order doesn't exist, or is closed/cancelled/voided, clear the table
    if (!order || ['CLOSED', 'CANCELLED', 'VOIDED'].includes(order.status)) {
      await prisma.posTable.update({
        where: { id: table.id },
        data: { currentOrderId: null }
      });
      cleared++;
      console.log(`Cleared table ${table.id} (was occupied by ${table.currentOrderId}, order status: ${order?.status || 'NOT_FOUND'})`);
    } else {
       console.log(`Kept table ${table.id} occupied by ${table.currentOrderId} (order status: ${order.status})`);
    }
  }
  console.log(`Cleared ${cleared} stuck tables.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
