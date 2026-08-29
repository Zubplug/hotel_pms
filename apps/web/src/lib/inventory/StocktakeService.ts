import prisma from '@hotel-pms/db';

export class StocktakeService {
  /**
   * Posts an APPROVED stocktake to the ledger atomically.
   * Calculates net variances, creates StockTransaction adjustments,
   * updates quantityOnHand, and sets the stocktake to COMPLETED.
   */
  static async postStocktake(stocktakeId: string, actorId: string, operationId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch the stocktake and ensure it's APPROVED
      const stocktake = await tx.stocktake.findUnique({
        where: { id: stocktakeId },
        include: { items: { include: { stockItem: true } } }
      });

      if (!stocktake) throw new Error('Stocktake not found');
      if (stocktake.status !== 'APPROVED') {
        throw new Error('Stocktake must be APPROVED before it can be posted');
      }

      // 2. Prevent duplicate posting via idempotency key if needed
      // (Using standard UUID logic, or we can just rely on the status check above)

      let totalShortageValue = 0;
      let totalOverageValue = 0;

      // 3. Loop through all items and apply variances
      for (const item of stocktake.items) {
        // If there's no variance, we don't need a ledger entry
        const variance = item.variance ? item.variance.toNumber() : 0;
        
        if (variance !== 0) {
          const costAtCount = item.costAtCount.toNumber();
          const varianceValue = variance * costAtCount;
          const quantityBefore = item.stockItem.quantityOnHand.toNumber();
          const quantityAfter = quantityBefore + variance;

          if (variance > 0) totalOverageValue += varianceValue;
          if (variance < 0) totalShortageValue += Math.abs(varianceValue);

          // Create ledger adjustment
          const transaction = await tx.stockTransaction.create({
            data: {
              propertyId: stocktake.propertyId,
              warehouseId: stocktake.warehouseId,
              stockItemId: item.stockItemId,
              source: 'ADJUSTMENT',
              quantity: variance,
              unitCost: costAtCount,
              totalValue: varianceValue,
              reference: stocktake.stocktakeRef,
              notes: `Stocktake variance`,
              operationId: `${operationId}_${item.stockItemId}`,
              userId: actorId,
              businessDate: new Date(),
              quantityBefore,
              quantityAfter,
            }
          });

          // Update actual quantity on hand by applying the variance
          await tx.stockItem.update({
            where: { id: item.stockItemId },
            data: {
              quantityOnHand: {
                increment: variance
              }
            }
          });

          // Link transaction to the item for audit trails
          await tx.stocktakeItem.update({
            where: { id: item.id },
            data: { transactionId: transaction.id }
          });
        }
      }

      // 4. Mark stocktake as COMPLETED
      const netVarianceValue = totalOverageValue - totalShortageValue;

      const updated = await tx.stocktake.update({
        where: { id: stocktake.id },
        data: {
          status: 'COMPLETED',
          completedBy: actorId,
          completedAt: new Date(),
          totalShortageValue,
          totalOverageValue,
          netVarianceValue
        }
      });

      return { success: true, stocktake: updated };
    });
  }
}
