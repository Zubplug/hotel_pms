import prisma, { StockTransactionSource } from '@hotel-pms/db';

export class InventoryService {
  /**
   * Submit a DRAFT GRN for approval.
   */
  static async submitReceipt(grnId: string, actorId: string) {
    const grn = await prisma.goodsReceivedNote.findUnique({ where: { id: grnId } });
    if (!grn) throw new Error('GRN not found');
    if (grn.status !== 'DRAFT') throw new Error('Only DRAFT GRNs can be submitted');

    return await prisma.goodsReceivedNote.update({
      where: { id: grnId },
      data: {
        status: 'SUBMITTED',
        submittedBy: actorId,
        submittedAt: new Date(),
        updatedBy: actorId,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Approve a SUBMITTED GRN.
   */
  static async approveReceipt(grnId: string, actorId: string) {
    const grn = await prisma.goodsReceivedNote.findUnique({ where: { id: grnId } });
    if (!grn) throw new Error('GRN not found');
    if (grn.status !== 'SUBMITTED') throw new Error('Only SUBMITTED GRNs can be approved');

    return await prisma.goodsReceivedNote.update({
      where: { id: grnId },
      data: {
        status: 'APPROVED',
        approvedBy: actorId,
        approvedAt: new Date(),
        updatedBy: actorId,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Reject a SUBMITTED GRN.
   */
  static async rejectReceipt(grnId: string, actorId: string, reason: string) {
    const grn = await prisma.goodsReceivedNote.findUnique({ where: { id: grnId } });
    if (!grn) throw new Error('GRN not found');
    if (grn.status !== 'SUBMITTED') throw new Error('Only SUBMITTED GRNs can be rejected');

    return await prisma.goodsReceivedNote.update({
      where: { id: grnId },
      data: {
        status: 'REJECTED',
        rejectedBy: actorId,
        rejectedAt: new Date(),
        rejectedReason: reason,
        updatedBy: actorId,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Post an APPROVED Goods Received Note (GRN) to stock.
   * Atomically increases quantityOnHand, creates StockTransaction(s), and marks GRN as POSTED.
   * If tied to a PO, increments receivedQty on the PO.
   */
  static async postReceipt(grnId: string, actorId: string, operationId: string) {
    // Idempotency check
    const existingTx = await prisma.stockTransaction.findFirst({
      where: { operationId, source: 'RECEIPT' }
    });
    if (existingTx) {
      return { success: true, message: 'Already processed', grnId };
    }

    return await prisma.$transaction(async (tx: any) => {
      const grn = await tx.goodsReceivedNote.findUnique({
        where: { id: grnId },
        include: { items: { include: { stockItem: true } }, purchaseOrder: { include: { items: true } } }
      });

      if (!grn) throw new Error('GRN not found');
      if (grn.status !== 'APPROVED') throw new Error('GRN must be APPROVED to post to stock');

      const property = await tx.property.findUnique({ where: { id: grn.propertyId } });
      const currency = property?.baseCurrency || 'NGN';

      for (const item of grn.items) {
        const qtyToReceive = item.receivedQty;
        if (qtyToReceive.lte(0)) continue;

        // 1. Update StockItem
        const stockItem = await tx.stockItem.update({
          where: { id: item.stockItemId },
          data: {
            quantityOnHand: { increment: qtyToReceive }
          }
        });

        // 2. Create StockTransaction audit ledger
        await tx.stockTransaction.create({
          data: {
            propertyId: grn.propertyId,
            stockItemId: stockItem.id,
            source: 'RECEIPT' as StockTransactionSource,
            quantity: qtyToReceive,
            unitCost: item.unitCost,
            quantityBefore: stockItem.quantityOnHand.minus(qtyToReceive),
            quantityAfter: stockItem.quantityOnHand,
            totalValue: qtyToReceive.mul(item.unitCost),
            currency,
            warehouseId: stockItem.warehouseId,
            grnId: grn.id,
            operationId: `${operationId}_${item.id}`,
            userId: actorId,
            businessDate: new Date(),
          }
        });

        // 3. Update PO if applicable
        if (grn.purchaseOrderId && grn.purchaseOrder) {
          const poItem = grn.purchaseOrder.items.find((p: any) => p.stockItemId === stockItem.id);
          if (poItem) {
            const freshPoItem = await tx.purchaseOrderItem.findUnique({ where: { id: poItem.id } });
            const remaining = Number(freshPoItem.quantity) - Number(freshPoItem.receivedQty);
            if (Number(qtyToReceive) > remaining) {
              throw new Error(`Over-receiving is not permitted. Item: ${stockItem.name}, Remaining: ${remaining}`);
            }
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: {
                receivedQty: { increment: qtyToReceive }
              }
            });
          }
        }
      }

      // Update PO Status if applicable
      if (grn.purchaseOrderId) {
        const updatedPoItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: grn.purchaseOrderId } });
        const allReceived = updatedPoItems.every((item: any) => Number(item.receivedQty) >= Number(item.quantity));
        await tx.purchaseOrder.update({
          where: { id: grn.purchaseOrderId },
          data: {
            status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
            updatedBy: actorId,
            updatedAt: new Date()
          }
        });
      }

      // Mark GRN as POSTED
      const updatedGrn = await tx.goodsReceivedNote.update({
        where: { id: grn.id },
        data: {
          status: 'POSTED',
          postedBy: actorId,
          postedAt: new Date(),
          updatedBy: actorId
        }
      });

      return { success: true, grn: updatedGrn };
    });
  }

  /**
   * Post an approved Stock Transfer.
   * Atomically decreases source warehouse stock, increases destination warehouse stock,
   * and creates TRANSFER StockTransactions for both sides.
   */
  static async postTransfer(transferId: string, actorId: string, operationId: string) {
    // Idempotency check
    const existingTransfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, status: 'POSTED' }
    });
    if (existingTransfer) {
      return { success: true, message: 'Already posted', transferId };
    }

    return await prisma.$transaction(async (tx: any) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: { items: { include: { stockItem: true } } }
      });

      if (!transfer) throw new Error('Transfer not found');
      if (transfer.status !== 'APPROVED') throw new Error('Transfer must be APPROVED before posting');

      const property = await tx.property.findUnique({ where: { id: transfer.propertyId } });
      const currency = property?.baseCurrency || 'NGN';

      for (const item of transfer.items) {
        // Need the destination stock item (usually mapped by barcode/SKU in destination warehouse)
        // For simplicity, assuming stockItem in transfer is the source. We must find/create the dest stock item.
        const sourceItem = await tx.stockItem.findUnique({ where: { id: item.stockItemId } });
        if (!sourceItem) continue;

        if (sourceItem.quantityOnHand.lt(item.quantity)) {
          throw new Error(`Insufficient stock for transfer on item: ${sourceItem.name}`);
        }

        let destItem = await tx.stockItem.findFirst({
          where: {
            propertyId: transfer.propertyId,
            warehouseId: transfer.toWarehouseId,
            barcode: sourceItem.barcode
          }
        });

        // Auto-create destination item if it doesn't exist
        if (!destItem) {
          destItem = await tx.stockItem.create({
            data: {
              propertyId: transfer.propertyId,
              warehouseId: transfer.toWarehouseId,
              name: sourceItem.name,
              sku: sourceItem.sku,
              barcode: sourceItem.barcode,
              baseUnit: sourceItem.baseUnit,
              costPrice: sourceItem.costPrice,
              quantityOnHand: 0,
              isActive: true
            }
          });
        }

        // 1. Deduct from Source
        const updatedSource = await tx.stockItem.update({
          where: { id: sourceItem.id },
          data: { quantityOnHand: { decrement: item.quantity } }
        });

        await tx.stockTransaction.create({
          data: {
            propertyId: transfer.propertyId,
            stockItemId: sourceItem.id,
            source: 'TRANSFER' as StockTransactionSource,
            quantity: item.quantity.mul(-1), // Negative for Out
            unitCost: sourceItem.costPrice,
            quantityBefore: sourceItem.quantityOnHand,
            quantityAfter: updatedSource.quantityOnHand,
            totalValue: item.quantity.mul(sourceItem.costPrice).mul(-1),
            currency,
            warehouseId: transfer.fromWarehouseId,
            transferId: transfer.id,
            operationId: `${operationId}_${item.id}_out`,
            userId: actorId,
            businessDate: new Date(),
          }
        });

        // 2. Add to Destination
        const updatedDest = await tx.stockItem.update({
          where: { id: destItem.id },
          data: { quantityOnHand: { increment: item.quantity } }
        });

        await tx.stockTransaction.create({
          data: {
            propertyId: transfer.propertyId,
            stockItemId: destItem.id,
            source: 'TRANSFER' as StockTransactionSource,
            quantity: item.quantity,
            unitCost: destItem.costPrice, // Maintain cost price across warehouse
            quantityBefore: destItem.quantityOnHand,
            quantityAfter: updatedDest.quantityOnHand,
            totalValue: item.quantity.mul(destItem.costPrice),
            currency,
            warehouseId: transfer.toWarehouseId,
            transferId: transfer.id,
            operationId: `${operationId}_${item.id}_in`,
            userId: actorId,
            businessDate: new Date(),
          }
        });
      }

      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'POSTED',
          postedBy: actorId,
          postedAt: new Date(),
          updatedAt: new Date()
        }
      });

      return { success: true, transfer: updatedTransfer };
    });
  }

  /**
   * Process a POS Sale.
   * Atomically deducts inventory based on RecipeIngredient mappings of POS items.
   */
  static async postSale(posOrderId: string, actorId?: string, operationId?: string) {
    const fallbackOpId = operationId || `op_sale_${posOrderId}`;

    // Idempotency check
    const existingTx = await prisma.stockTransaction.findFirst({
      where: { operationId: fallbackOpId, source: 'SALE' }
    });
    if (existingTx) {
      return { success: true, message: 'Sale already deducted' };
    }

    return await prisma.$transaction(async (tx: any) => {
      const order = await tx.posOrder.findUnique({
        where: { id: posOrderId },
        include: { items: { include: { product: { include: { recipeIngredients: true } } } } }
      });

      if (!order) throw new Error('POS Order not found');

      const property = await tx.property.findUnique({ where: { id: order.propertyId } });
      const currency = property?.baseCurrency || 'NGN';

      for (const orderItem of order.items) {
        if (!orderItem.product || !orderItem.product.recipeIngredients) continue;

        const orderQty = orderItem.quantity; // E.g. 2 Burgers

        for (const recipe of orderItem.product.recipeIngredients) {
          const totalConsumption = recipe.quantity.mul(orderQty); // 2 Burgers * 1 Bun = 2 Buns

          const stockItem = await tx.stockItem.findUnique({
            where: { id: recipe.stockItemId }
          });

          if (!stockItem) continue;

          const updatedStock = await tx.stockItem.update({
            where: { id: stockItem.id },
            data: {
              quantityOnHand: { decrement: totalConsumption }
            }
          });

          await tx.stockTransaction.create({
            data: {
              propertyId: order.propertyId,
              stockItemId: stockItem.id,
              source: 'SALE' as StockTransactionSource,
              quantity: totalConsumption.mul(-1),
              unitCost: stockItem.costPrice,
              quantityBefore: stockItem.quantityOnHand,
              quantityAfter: updatedStock.quantityOnHand,
              totalValue: totalConsumption.mul(stockItem.costPrice).mul(-1),
              currency,
              warehouseId: stockItem.warehouseId,
              reference: order.id,
              operationId: `${fallbackOpId}_${orderItem.id}_${recipe.id}`,
              userId: actorId || order.serverStaffId || null,
              businessDate: order.businessDate || new Date(),
            }
          });
        }
      }

      return { success: true };
    });
  }
}
