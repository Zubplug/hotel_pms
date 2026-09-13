const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/web/src/lib/inventory/InventoryService.ts');
let content = fs.readFileSync(filePath, 'utf8');

const postWasteMethod = `
  /**
   * Post an APPROVED Kitchen Waste Entry to stock.
   * Atomically deducts quantityOnHand and creates a StockTransaction ledger entry.
   * Ensures idempotency to prevent duplicate stock deductions.
   */
  static async postWaste(wasteId: string, actorId: string, operationId: string) {
    // Ensure we don't duplicate post by checking StockTransaction
    const existingTx = await prisma.stockTransaction.findFirst({
      where: { operationId, source: 'WASTE' }
    });
    if (existingTx) {
      return { success: true, message: 'Already processed', wasteId };
    }

    return await prisma.$transaction(async (tx: any) => {
      const entry = await tx.kitchenWasteEntry.findUnique({
        where: { id: wasteId },
        include: { stockItem: true }
      });
      if (!entry) throw new Error('Waste entry not found');
      
      // Concurrency check: If already approved/posted, skip stock deduction
      if (entry.status !== 'SUBMITTED') {
        throw new Error('Waste entry is not in SUBMITTED state. Cannot post.');
      }

      const property = await tx.property.findUnique({ where: { id: entry.propertyId } });
      if (!property?.businessDate) throw new Error('Property business date is not initialized. Cannot post waste.');
      const currency = property?.baseCurrency || 'NGN';

      const baseQuantity = Number(entry.baseQuantity);
      if (baseQuantity <= 0) throw new Error('Waste quantity must be greater than zero');

      // 1. Deduct Stock
      const stockItem = await tx.stockItem.findUnique({ where: { id: entry.stockItemId } });
      if (!stockItem) throw new Error('Stock item not found');

      if (Number(stockItem.quantityOnHand) < baseQuantity) {
         // Some businesses allow negative stock, but typically waste shouldn't exceed on-hand.
         // We will allow negative stock deduction, as physical count takes precedence over system bounds.
      }

      const updatedStock = await tx.stockItem.update({
        where: { id: stockItem.id },
        data: { quantityOnHand: { decrement: baseQuantity } }
      });

      // 2. Audit Ledger
      await tx.stockTransaction.create({
        data: {
          propertyId: entry.propertyId,
          stockItemId: stockItem.id,
          source: 'WASTE', // Use appropriate enum if exists, or standard string
          quantity: baseQuantity * -1, // Negative because it's a deduction
          unitCost: stockItem.costPrice,
          quantityBefore: stockItem.quantityOnHand,
          quantityAfter: updatedStock.quantityOnHand,
          totalValue: baseQuantity * Number(stockItem.costPrice) * -1,
          currency,
          warehouseId: stockItem.warehouseId,
          operationId,
          userId: actorId,
          businessDate: property.businessDate,
          notes: \`Waste: \${entry.reason}\`
        }
      });

      // 3. Mark Entry as APPROVED/POSTED
      const updatedEntry = await tx.kitchenWasteEntry.update({
        where: { id: wasteId },
        data: {
          status: 'APPROVED',
          approvedBy: actorId,
        }
      });

      return { success: true, entry: updatedEntry };
    });
  }
`;

// Insert the postWaste method right before the last closing brace of the class.
content = content.replace(/}\s*$/, \`\${postWasteMethod}\n}\`);
fs.writeFileSync(filePath, content);
console.log('Added postWaste to InventoryService.ts');
