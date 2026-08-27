import prisma, { StockTransactionSource } from '@hotel-pms/db';

export class InventoryService {
  /** Restore every committed ingredient for a cancelled/voided order. */
  static async restoreSale(posOrderId: string, actorId: string, operationId: string, txOverride?: any) {
    const restore = async (tx: any) => {
      const committed = await tx.stockTransaction.findMany({ where: { reference: posOrderId, source: 'SALE' } });
      for (const sale of committed) {
        const reversalOperation = `${operationId}_${sale.stockItemId}`;
        const alreadyRestored = await tx.stockTransaction.findUnique({ where: { operationId: reversalOperation } });
        if (alreadyRestored) continue;
        const quantity = Math.abs(Number(sale.quantity));
        const stock = await tx.stockItem.findUnique({ where: { id: sale.stockItemId } });
        if (!stock) throw new Error(`Inventory item not found for reversal: ${sale.stockItemId}`);
        const updated = await tx.stockItem.update({ where: { id: stock.id }, data: { quantityOnHand: { increment: quantity } } });
        await tx.stockTransaction.create({
          data: {
            propertyId: sale.propertyId, stockItemId: sale.stockItemId, source: 'POS_VOID', quantity,
            unitCost: stock.costPrice, quantityBefore: stock.quantityOnHand, quantityAfter: updated.quantityOnHand,
            totalValue: quantity * Number(stock.costPrice), currency: sale.currency, warehouseId: stock.warehouseId,
            reference: posOrderId, notes: `Inventory restored for cancelled/voided order ${posOrderId}`,
            operationId: reversalOperation, userId: actorId, businessDate: new Date(),
          },
        });
      }
      return { success: true, restoredCount: committed.length };
    };
    return txOverride ? restore(txOverride) : prisma.$transaction(restore);
  }

  /** Commit a sale inside the caller's transaction. This is the final
   * concurrency-safe gate before an order is closed/paid. */
  static async commitSaleInTransaction(tx: any, posOrderId: string, actorId: string, operationId: string, overrideApprovalId?: string) {
    const existing = await tx.stockTransaction.findFirst({ where: { operationId: { startsWith: operationId }, source: 'SALE' } });
    if (existing) return { success: true, message: 'Sale already deducted' };

    const order = await tx.posOrder.findUnique({
      where: { id: posOrderId },
      include: { items: { include: { product: { include: { recipe: { include: { versions: { where: { isActive: true }, include: { ingredients: true } } } } } } } } },
    });
    if (!order) throw new Error('POS Order not found');

    const requirements = new Map<string, number>();
    for (const item of order.items) {
      if (item.product?.inventoryMode !== 'STOCK') continue;
      const ingredients = item.product.recipe?.versions?.[0]?.ingredients || [];
      if (!ingredients.length) throw new Error(`Inventory mapping is missing for ${item.productName}`);
      for (const recipe of ingredients) {
        requirements.set(recipe.stockItemId, (requirements.get(recipe.stockItemId) || 0) + Number(recipe.quantity) * Number(item.quantity));
      }
    }

    const property = await tx.property.findUnique({ where: { id: order.propertyId } });
    const currency = property?.baseCurrency || 'NGN';
    for (const [stockItemId, required] of requirements) {
      const stock = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      if (!stock || !stock.isActive) throw new Error('Inventory item is unavailable');
      const updated = await tx.stockItem.updateMany({
        where: { id: stockItemId, isActive: true, quantityOnHand: { gte: required } },
        data: { quantityOnHand: { decrement: required } },
      });
      if (updated.count !== 1) {
        if (!overrideApprovalId) throw new Error(`Insufficient stock for ${stock.name}`);
        const approval = await tx.approvalRequest.findUnique({ where: { id: overrideApprovalId } });
        const details = (approval?.details || {}) as any;
        if (!approval || approval.propertyId !== order.propertyId || approval.type !== 'INVENTORY_NEGATIVE_STOCK' || approval.status !== 'APPROVED' || details.orderId !== order.id) {
          throw new Error(`Manager approval is invalid for negative stock on ${stock.name}`);
        }
        const forced = await tx.stockItem.updateMany({ where: { id: stockItemId, isActive: true }, data: { quantityOnHand: { decrement: required } } });
        if (forced.count !== 1) throw new Error(`Unable to apply approved stock override for ${stock.name}`);
        const forcedAfter = await tx.stockItem.findUnique({ where: { id: stockItemId } });
        await tx.stockTransaction.create({
          data: {
            propertyId: order.propertyId, stockItemId, source: 'SALE', quantity: -required,
            unitCost: stock.costPrice, quantityBefore: Number(stock.quantityOnHand), quantityAfter: Number(forcedAfter?.quantityOnHand || 0),
            totalValue: -required * Number(stock.costPrice), currency, warehouseId: stock.warehouseId, reference: order.id,
            operationId: `${operationId}_${stockItemId}`, userId: actorId, approvalId: overrideApprovalId,
            notes: `Negative stock authorized by manager approval ${overrideApprovalId}`, businessDate: order.businessDate || new Date(),
          },
        });
        continue;
      }
      const after = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      await tx.stockTransaction.create({
        data: {
          propertyId: order.propertyId, stockItemId, source: 'SALE', quantity: -required,
          unitCost: stock.costPrice, quantityBefore: Number(stock.quantityOnHand),
          quantityAfter: Number(after?.quantityOnHand || 0), totalValue: -required * Number(stock.costPrice),
          currency, warehouseId: stock.warehouseId, reference: order.id,
          operationId: `${operationId}_${stockItemId}`, userId: actorId || order.serverStaffId || null,
          businessDate: order.businessDate || new Date(),
        },
      });
    }
    return { success: true };
  }

  /** Restore the quantity represented by an approved POS refund. The ratio is
   * based on the refunded amount and order total, and every reversal is
   * idempotent and auditable. Item-level quantities can be added later without
   * changing the ledger contract. */
  static async restoreSaleForRefund(tx: any, posOrderId: string, refundAmount: number, actorId: string, operationId: string) {
    const order = await tx.posOrder.findUnique({ where: { id: posOrderId }, select: { total: true } });
    if (!order || Number(order.total) <= 0) throw new Error('POS order is unavailable for inventory refund');
    const ratio = Math.min(1, Math.max(0, refundAmount / Number(order.total)));
    const sales = await tx.stockTransaction.findMany({ where: { reference: posOrderId, source: 'SALE' } });
    for (const sale of sales) {
      const reversalOperation = `${operationId}_${sale.stockItemId}`;
      if (await tx.stockTransaction.findUnique({ where: { operationId: reversalOperation } })) continue;
      const quantity = Math.abs(Number(sale.quantity)) * ratio;
      if (quantity <= 0) continue;
      const stock = await tx.stockItem.findUnique({ where: { id: sale.stockItemId } });
      if (!stock) throw new Error(`Inventory item not found for refund: ${sale.stockItemId}`);
      const updated = await tx.stockItem.update({ where: { id: stock.id }, data: { quantityOnHand: { increment: quantity } } });
      await tx.stockTransaction.create({ data: {
        propertyId: sale.propertyId, stockItemId: sale.stockItemId, source: 'POS_REFUND', quantity,
        unitCost: stock.costPrice, quantityBefore: stock.quantityOnHand, quantityAfter: updated.quantityOnHand,
        totalValue: quantity * Number(stock.costPrice), currency: sale.currency, warehouseId: stock.warehouseId,
        reference: posOrderId, notes: `Stock restored for POS refund ${operationId} (${(ratio * 100).toFixed(2)}%)`,
        operationId: reversalOperation, userId: actorId, businessDate: new Date(),
      } });
    }
  }

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
        include: { items: true, purchaseOrder: { include: { items: true } } }
      });

      if (!grn) throw new Error('GRN not found');
      if (grn.status !== 'APPROVED') throw new Error('GRN must be APPROVED to post to stock');

      const property = await tx.property.findUnique({ where: { id: grn.propertyId } });
      const currency = property?.baseCurrency || 'NGN';
      const stockItems = await tx.stockItem.findMany({ where: { id: { in: grn.items.map((item: any) => item.stockItemId) } } });

      for (const item of grn.items) {
        const qtyToReceive = item.receivedQty;
        if (qtyToReceive.lte(0)) continue;

        // 1. Update StockItem with MAC
        const existingStockItem = stockItems.find((candidate: any) => candidate.id === item.stockItemId);
        if (!existingStockItem) throw new Error(`Stock item not found: ${item.stockItemId}`);

        const currentQty = Number(existingStockItem.quantityOnHand);
        const currentCost = Number(existingStockItem.costPrice);
        const receivedQty = Number(item.receivedQty);
        const receivedCost = Number(item.unitCost);

        const currentTotalValue = currentQty * currentCost;
        const receivedTotalValue = receivedQty * receivedCost;
        const newTotalQty = currentQty + receivedQty;
        const newMac = newTotalQty > 0 ? (currentTotalValue + receivedTotalValue) / newTotalQty : currentCost;

        const stockItem = await tx.stockItem.update({
          where: { id: item.stockItemId },
          data: {
            quantityOnHand: { increment: item.receivedQty },
            costPrice: newMac
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
    return prisma.$transaction((tx: any) =>
      InventoryService.commitSaleInTransaction(tx, posOrderId, actorId || 'system', fallbackOpId)
    );
  }

  /**
   * Approve a Cost Adjustment Request
   * Revalues the inventory and creates a financial StockTransaction without changing quantity.
   */
  static async approveCostAdjustment(adjustmentId: string, actorId: string, operationId: string) {
    return await prisma.$transaction(async (tx: any) => {
      const adjustment = await tx.costAdjustment.findUnique({
        where: { id: adjustmentId },
        include: { stockItem: true }
      });

      if (!adjustment) throw new Error('Cost adjustment not found');
      if (adjustment.status !== 'SUBMITTED') throw new Error('Cost adjustment must be SUBMITTED to approve');

      const stockItem = adjustment.stockItem;
      const qty = Number(stockItem.quantityOnHand);
      const oldCost = Number(adjustment.oldCost);
      const newCost = Number(adjustment.proposedCost);
      const valueDifference = (newCost - oldCost) * qty;

      // 1. Mark adjustment as APPROVED
      await tx.costAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'APPROVED',
          approvedBy: actorId,
          approvedAt: new Date()
        }
      });

      // 2. Update StockItem Cost Price
      await tx.stockItem.update({
        where: { id: stockItem.id },
        data: { costPrice: newCost }
      });

      // 3. Create Audit Ledger (zero quantity, but captures value shift)
      const property = await tx.property.findUnique({ where: { id: adjustment.propertyId } });
      const currency = property?.baseCurrency || 'NGN';

      await tx.stockTransaction.create({
        data: {
          propertyId: adjustment.propertyId,
          stockItemId: stockItem.id,
          source: 'ADJUSTMENT', // Using standard ADJUSTMENT for Cost valuation shifts
          quantity: 0,
          unitCost: newCost,
          quantityBefore: qty,
          quantityAfter: qty,
          totalValue: valueDifference,
          currency,
          warehouseId: stockItem.warehouseId,
          operationId,
          userId: actorId,
          businessDate: new Date(),
          notes: `Cost Revaluation: ${adjustment.reason}`
        }
      });

      return { success: true };
    });
  }
}
