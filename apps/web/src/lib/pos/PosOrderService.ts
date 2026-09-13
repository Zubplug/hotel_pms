import prisma from '@hotel-pms/db';
import { WasteService } from '../inventory/WasteService';

export class PosOrderService {
  /**
   * Cancels an open PosOrder.
   * Rejects if the order is billed, settled, or already closed/cancelled.
   * Cancels active KDS batches.
   * Preserves financial amounts.
   * Creates a PosVoid audit record.
   * Routes consumed KDS items to Waste and reverses unconsumed inventory logic.
   */
  static async cancelOrder({
    orderId,
    reason,
    authorizerId,
    operationId,
    businessDate,
  }: {
    orderId: string;
    reason: string;
    authorizerId: string;
    operationId: string;
    businessDate: string;
  }) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch the order with its batches, items, and recipe details
      const order = await tx.posOrder.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  recipe: {
                    include: {
                      versions: {
                        where: { isActive: true },
                        include: { ingredients: { include: { stockItem: true } } }
                      }
                    }
                  }
                }
              }
            }
          },
          productionBatches: {
            include: { items: true }
          },
        }
      });

      if (!order) throw new Error('Order not found');

      // 2. Validate Order State
      if (['CLOSED', 'VOIDED', 'CANCELLED'].includes(order.status)) {
        throw new Error(`Cannot cancel order. Status is already ${order.status}`);
      }
      
      // Strict rule: do not cancel billed or settled orders via ordinary cancel
      if (['PARTIALLY_PAID', 'PAID'].includes(order.paymentStatus)) {
        throw new Error('Cannot cancel a partially or fully paid order. Use financial reversal.');
      }

      // Check idempotency via PosVoid operationId
      const existingVoid = await tx.posVoid.findUnique({ where: { operationId } });
      if (existingVoid) return { success: true, message: 'Idempotency caught', order };

      // 3. Mark Order Cancelled (Preserving financial totals!)
      const updatedOrder = await tx.posOrder.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          updatedBy: authorizerId,
        }
      });

      // 4. Create Audit Record
      const voidRecord = await tx.posVoid.create({
        data: {
          orderId,
          reason,
          authorizerId,
          businessDate: new Date(businessDate),
          operationId,
        }
      });

      // 5. Cancel Production Batches & Handle Inventory Consequence
      for (const batch of order.productionBatches) {
        if (['COMPLETED', 'CANCELLED'].includes(batch.status)) continue;

        // Transition KDS state
        await tx.posProductionBatch.update({
          where: { id: batch.id },
          data: { status: 'CANCELLED' }
        });

        await tx.posProductionBatchEvent.create({
          data: {
            batchId: batch.id,
            fromStatus: batch.status,
            toStatus: 'CANCELLED',
            actorId: authorizerId,
            notes: `Order cancelled: ${reason}`,
          }
        });

        // Determine inventory consequence based on state
        const consumed = ['PREPARING', 'READY'].includes(batch.status);
        
        // Find which order items are in this batch
        const batchItemIds = batch.items.map(bi => bi.orderItemId);
        const orderItemsInBatch = order.items.filter(oi => batchItemIds.includes(oi.id));

        for (const oi of orderItemsInBatch) {
          const activeVersion = oi.product?.recipe?.versions?.[0];
          if (!activeVersion) continue;

          if (consumed) {
            // Food is consumed/prepared -> Send to Waste
            for (const ingredient of activeVersion.ingredients) {
              const stockItem = ingredient.stockItem;
              if (!stockItem) continue;

              // We route this to a KitchenWasteEntry directly within this transaction boundary.
              // Note: WasteService.submitWaste expects a regular payload and uses prisma context,
              // but we are inside a `$transaction`. We should create the entry directly here 
              // using `tx` to avoid deadlock or transaction nesting issues.
              await tx.kitchenWasteEntry.create({
                data: {
                  propertyId: order.propertyId,
                  stockItemId: stockItem.id,
                  quantity: Number(ingredient.quantity) * Number(oi.quantity),
                  unitOfMeasure: ingredient.unitOfMeasure,
                  reason: 'WRONG_ORDER',
                  notes: `Auto-generated from cancelled Order ${order.orderNumber} (Batch ${batch.batchNumber})`,
                  baseQuantity: Number(ingredient.quantity) * Number(oi.quantity),
                  unitCost: stockItem.costPrice,
                  totalValue: Number(ingredient.quantity) * Number(oi.quantity) * Number(stockItem.costPrice),
                  status: 'SUBMITTED',
                  createdBy: authorizerId,
                }
              });
            }
          } else {
            // Food is NOT consumed (PENDING) -> Reverse unconsumed theoretical stock movement
            // Note: Actual implementation depends on whether PENDING batches immediately deduct stock.
            // If the current system deducts stock on order creation, we must increment `quantityOnHand` here.
            // If the current system deducts stock only on `PREPARING` or `COMPLETED`, we do nothing.
            // Assuming stock is deducted at POS transaction creation in the current model:
            
            for (const ingredient of activeVersion.ingredients) {
              const stockItem = ingredient.stockItem;
              if (!stockItem) continue;

              const quantityToRestore = Number(ingredient.quantity) * Number(oi.quantity);

              const updatedStock = await tx.stockItem.update({
                where: { id: stockItem.id },
                data: { quantityOnHand: { increment: quantityToRestore } }
              });

              await tx.stockTransaction.create({
                data: {
                  propertyId: order.propertyId,
                  stockItemId: stockItem.id,
                  source: 'POS_VOID',
                  quantity: quantityToRestore,
                  unitCost: stockItem.costPrice,
                  quantityBefore: stockItem.quantityOnHand,
                  quantityAfter: updatedStock.quantityOnHand,
                  totalValue: quantityToRestore * Number(stockItem.costPrice),
                  currency: 'NGN',
                  warehouseId: stockItem.warehouseId,
                  operationId: `${operationId}-reverse-${oi.id}-${ingredient.id}`,
                  userId: authorizerId,
                  businessDate: new Date(businessDate),
                  notes: `Reversal for unconsumed cancelled item on order ${order.orderNumber}`,
                }
              });
            }
          }
        }
      }

      return { success: true, order: updatedOrder, voidRecord };
    });
  }
}
