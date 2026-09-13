import prisma from '@hotel-pms/db';

async function cleanup() {
  console.log('--- Cleaning up E2E Test Data from Production ---');

  // Find dummy stock items
  const dummyItems = await prisma.stockItem.findMany({
    where: { sku: { startsWith: 'TOM-' } }
  });

  const dummyItemIds = dummyItems.map((i: any) => i.id);

  if (dummyItemIds.length > 0) {
    // Find POs that have these dummy items
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: { stockItemId: { in: dummyItemIds } }
    });
    
    const poIds = [...new Set(poItems.map((pi: any) => pi.purchaseOrderId))];

    for (const poId of poIds) {
      if (!poId) continue;
      console.log(`Cleaning up PO: ${poId}`);
      
      const grns = await prisma.goodsReceivedNote.findMany({ where: { purchaseOrderId: poId } });
      for (const grn of grns) {
        // Delete stock transactions
        await prisma.stockTransaction.deleteMany({ where: { grnId: grn.id } });
        // Delete GRN items
        await prisma.goodsReceivedNoteItem.deleteMany({ where: { grnId: grn.id } });
        // Delete GRN
        await prisma.goodsReceivedNote.delete({ where: { id: grn.id } });
        console.log(`  Deleted GRN: ${grn.grnNumber}`);
      }
      
      // Delete PO items
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: poId } });
      // Delete PO
      await prisma.purchaseOrder.delete({ where: { id: poId } });
    }

    // Now delete the dummy stock items themselves
    for (const item of dummyItems) {
      // Make sure we delete any stray transactions just in case
      await prisma.stockTransaction.deleteMany({ where: { stockItemId: item.id } });
      await prisma.stockItem.delete({ where: { id: item.id } });
      console.log(`Deleted dummy StockItem: ${item.sku}`);
    }
  }

  console.log('Cleanup complete.');
}

cleanup().catch(console.error).finally(() => prisma.$disconnect());
