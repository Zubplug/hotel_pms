import prisma, { StockTransactionSource } from '@hotel-pms/db';
import { assertNightAuditAllowsTransaction } from '@/lib/night-audit-guard';
import { GRN_STATUS, TRANSFER_STATUS, PO_STATUS } from '@/lib/inventory/types';
import { TenantContext } from '../organization-access';
import { isKitchenProductionStation, kitchenServiceOutletId } from './kitchen-routing';
import { getUnitConversionToBase } from './units';

function normalizeStockName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

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
            operationId: reversalOperation, userId: actorId, businessDate: sale.businessDate,
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
      include: {
        items: {
          include: {
            product: {
              include: {
                recipe: {
                  include: {
                    versions: {
                      where: { isActive: true },
                      include: {
                        ingredients: {
                          include: { stockItem: { select: { id: true, baseUnit: true, stockType: true, stockUnits: true } } },
                        },
                      },
                    },
                  },
                },
                category: { select: { productionStation: true } },
                modifiers: true,
              },
            },
          },
        },
      },
    });
    if (!order) throw new Error('POS Order not found');

    const requirements = new Map<string, { quantity: number; centralKitchen: boolean }>();
    const productUsesKitchen = (product: any) => isKitchenProductionStation(
      product?.productionStation ?? product?.category?.productionStation,
    );
    const addRequirement = (stockItemId: string, quantity: number, centralKitchen: boolean) => {
      const current = requirements.get(stockItemId);
      requirements.set(stockItemId, {
        quantity: (current?.quantity || 0) + quantity,
        centralKitchen: Boolean(current?.centralKitchen || centralKitchen),
      });
    };
    for (const item of order.items) {
      if (item.product?.inventoryMode === 'STOCK') {
        const ingredients = item.product.recipe?.versions?.[0]?.ingredients || [];
        if (!ingredients.length) {
          throw new Error(`Item ${item.productName} requires an active Recipe because its inventoryMode is STOCK. No recipe found.`);
        }
        for (const recipe of ingredients) {
          const conversion = getUnitConversionToBase(recipe.unitOfMeasure, recipe.stockItem?.baseUnit, recipe.stockItem?.stockUnits || []);
          if (conversion <= 0) throw new Error(`No conversion configured from ${recipe.unitOfMeasure} to ${recipe.stockItem?.baseUnit || 'base unit'} for ${item.productName}`);
          addRequirement(recipe.stockItemId, Number(recipe.quantity) * conversion * Number(item.quantity), productUsesKitchen(item.product));
        }
      }
      for (const modifier of item.modifiers || []) {
        if (!modifier.stockItemId || Number(modifier.quantity) <= 0) continue;
        const stock = await tx.stockItem.findUnique({ where: { id: modifier.stockItemId }, select: { baseUnit: true, stockType: true, stockUnits: true } });
        const conversion = getUnitConversionToBase(modifier.unitOfMeasure, stock?.baseUnit, stock?.stockUnits || []);
        if (conversion <= 0) throw new Error(`No conversion configured for modifier ${modifier.name}`);
        addRequirement(modifier.stockItemId, Number(modifier.quantity) * conversion * Number(item.quantity), productUsesKitchen(item.product));
      }
    }

    const property = await tx.property.findUnique({ where: { id: order.propertyId }, select: { baseCurrency: true, settings: true } });
    if (!property) throw new Error('POS property is unavailable');

    const outletWarehouse = await tx.warehouse.findUnique({
      where: { posOutletId: order.outletId },
      select: { id: true, name: true },
    });
    if (!outletWarehouse) throw new Error(`POS outlet has no stock warehouse configured: ${order.outletId}`);

    const needsKitchenStock = [...requirements.values()].some((entry) => entry.centralKitchen);
    const kitchenOutletId = kitchenServiceOutletId(property.settings);
    const kitchenWarehouse = needsKitchenStock && kitchenOutletId
      ? await tx.warehouse.findUnique({ where: { posOutletId: kitchenOutletId }, select: { id: true, name: true } })
      : null;
    if (needsKitchenStock && !kitchenWarehouse) {
      throw new Error('Kitchen-serving outlet is not configured for this property. POS kitchen stock cannot be consumed safely.');
    }

    // Recipe and modifier mappings can point to a template stock item in the
    // main warehouse. Resolve every requirement to the matching item in the
    // selling outlet warehouse before changing quantity.
    const templateItems = await tx.stockItem.findMany({
      where: { id: { in: [...requirements.keys()] }, propertyId: order.propertyId },
      select: { id: true, name: true, sku: true, barcode: true, stockType: true },
    });
    const targetWarehouseIds = [...new Set([outletWarehouse.id, kitchenWarehouse?.id].filter(Boolean) as string[])];
    const outletItems = await tx.stockItem.findMany({
      where: { propertyId: order.propertyId, warehouseId: { in: targetWarehouseIds }, isActive: true },
      select: { id: true, name: true, sku: true, barcode: true, warehouseId: true },
    });
    const resolvedRequirements = new Map<string, number>();
    for (const [templateId, requirement] of requirements) {
      const template = templateItems.find((item: any) => item.id === templateId);
      if (!template) throw new Error(`Inventory mapping is missing for stock item ${templateId}`);
      const targetWarehouseId = requirement.centralKitchen ? kitchenWarehouse?.id : outletWarehouse.id;
      const target = outletItems.find((item: any) => item.warehouseId === targetWarehouseId && (
        (template.barcode && item.barcode === template.barcode) ||
        (template.sku && item.sku === template.sku) ||
        item.name.trim().toLowerCase() === template.name.trim().toLowerCase()
      ));
      if (!target) throw new Error(`${template.name} is not provisioned in ${requirement.centralKitchen ? kitchenWarehouse?.name : outletWarehouse.name}`);
      resolvedRequirements.set(target.id, (resolvedRequirements.get(target.id) || 0) + requirement.quantity);
    }

    const currency = property?.baseCurrency || 'NGN';
    for (const [stockItemId, required] of resolvedRequirements) {
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
        operationId: reversalOperation, userId: actorId, businessDate: sale.businessDate,
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
        status: GRN_STATUS.SUBMITTED,
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
    if (grn.status !== GRN_STATUS.SUBMITTED) throw new Error('Only SUBMITTED GRNs can be approved');

    return await prisma.goodsReceivedNote.update({
      where: { id: grnId },
      data: {
        status: GRN_STATUS.APPROVED,
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
    if (grn.status !== GRN_STATUS.SUBMITTED) throw new Error('Only SUBMITTED GRNs can be rejected');

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
  static async postReceipt(ctx: TenantContext, grnId: string, actorId: string, operationId: string) {
    const guardRecord = await prisma.goodsReceivedNote.findUnique({ where: { id: grnId }, select: { propertyId: true } });
    if (!guardRecord) throw new Error('GRN not found');
    if (!ctx.propertyIds.includes(guardRecord.propertyId)) throw new Error('FORBIDDEN');
    await assertNightAuditAllowsTransaction(guardRecord.propertyId);
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
      if (grn.status !== GRN_STATUS.APPROVED) throw new Error('GRN must be APPROVED to post to stock');

      const property = await tx.property.findUnique({ where: { id: grn.propertyId } });
      if (!property?.businessDate) throw new Error('Property business date is not initialized. Cannot post receipt.');
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
        const poItem = grn.purchaseOrder?.items.find((p: any) => p.stockItemId === existingStockItem.id);
        const conversionToBase = Number(poItem?.conversionToBase || 1);
        const receivedQtyInBase = Number(item.baseReceivedQty || receivedQty * conversionToBase);
        const receivedCostPerBase = Number(item.baseUnitCost || (conversionToBase > 0 ? receivedCost / conversionToBase : receivedCost));

        const currentTotalValue = currentQty * currentCost;
        const receivedTotalValue = receivedQtyInBase * receivedCostPerBase;
        const newTotalQty = currentQty + receivedQtyInBase;
        const newMac = newTotalQty > 0 ? (currentTotalValue + receivedTotalValue) / newTotalQty : currentCost;

        const stockItem = await tx.stockItem.update({
          where: { id: item.stockItemId },
          data: {
            quantityOnHand: { increment: receivedQtyInBase },
            costPrice: newMac
          }
        });

        // Keep the entered procurement price on the configured purchase-unit
        // row. StockItem.costPrice remains the base-unit MAC used for costing.
        if (poItem?.unitOfMeasure && conversionToBase > 0) {
          await tx.stockItemUnit.updateMany({
            where: {
              stockItemId: item.stockItemId,
              unit: poItem.unitOfMeasure,
              isPurchaseUnit: true,
            },
            data: { purchaseCost: receivedCost },
          });
        }

        // 2. Create StockTransaction audit ledger
        await tx.stockTransaction.create({
          data: {
            propertyId: grn.propertyId,
            stockItemId: stockItem.id,
            source: 'RECEIPT' as StockTransactionSource,
            quantity: receivedQtyInBase,
            unitCost: receivedCostPerBase,
            quantityBefore: stockItem.quantityOnHand.minus(receivedQtyInBase),
            quantityAfter: stockItem.quantityOnHand,
            totalValue: receivedQtyInBase * receivedCostPerBase,
            currency,
            warehouseId: stockItem.warehouseId,
            grnId: grn.id,
            operationId: `${operationId}_${item.id}`,
            userId: actorId,
            businessDate: property.businessDate,
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
            status: allReceived ? PO_STATUS.RECEIVED : PO_STATUS.PARTIALLY_RECEIVED,
            updatedBy: actorId,
            updatedAt: new Date()
          }
        });
      }

      // Mark GRN as POSTED
      const updatedGrn = await tx.goodsReceivedNote.update({
        where: { id: grn.id },
        data: {
          status: GRN_STATUS.POSTED,
          postedBy: actorId,
          postedAt: new Date(),
          updatedBy: actorId
        }
      });

      return { success: true, grn: updatedGrn };
    }, { maxWait: 10000, timeout: 25000 });
  }

  /**
   * Post an approved Stock Transfer.
   * Atomically decreases source warehouse stock, increases destination warehouse stock,
   * and creates TRANSFER StockTransactions for both sides.
   */
  static async postTransfer(ctx: TenantContext, transferId: string, actorId: string, operationId: string) {
    const guardRecord = await prisma.stockTransfer.findUnique({ where: { id: transferId }, select: { propertyId: true } });
    if (!guardRecord) throw new Error('Transfer not found');
    if (!ctx.propertyIds.includes(guardRecord.propertyId)) throw new Error('FORBIDDEN');
    await assertNightAuditAllowsTransaction(guardRecord.propertyId);
    // Idempotency check
    const existingTransfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, status: TRANSFER_STATUS.COMPLETED }
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
      if (transfer.status !== TRANSFER_STATUS.APPROVED) throw new Error('Transfer must be APPROVED before posting');

      const property = await tx.property.findUnique({ where: { id: transfer.propertyId } });
      const currency = property?.baseCurrency || 'NGN';

      for (const item of transfer.items) {
        // Need the destination stock item (usually mapped by barcode/SKU in destination warehouse)
        // For simplicity, assuming stockItem in transfer is the source. We must find/create the dest stock item.
        const sourceItem = await tx.stockItem.findUnique({ where: { id: item.stockItemId }, include: { stockUnits: true } });
        if (!sourceItem) continue;

        // Recalculate from the current source item definition. A transfer line
        // may have been created against an older item identity/unit setup (for
        // example, after a duplicate stock item was consolidated). Never trust
        // a stale baseQuantity in that case, or a valid transfer can report a
        // false insufficient-stock error.
        const conversion = item.unitOfMeasure === sourceItem.baseUnit
          ? 1
          : Number(sourceItem.stockUnits.find((unit: any) => unit.unit === item.unitOfMeasure)?.unitsInBase || 0);
        if (conversion <= 0) {
          throw new Error(`No conversion configured from ${item.unitOfMeasure} to ${sourceItem.baseUnit} for ${sourceItem.name}`);
        }
        const transferQuantity = Number(item.quantity) * conversion;
        if (Number(item.baseQuantity) !== transferQuantity) {
          await tx.stockTransferItem.update({
            where: { id: item.id },
            data: { baseQuantity: transferQuantity },
          });
        }

        if (sourceItem.quantityOnHand.lt(transferQuantity)) {
          throw new Error(`Insufficient stock for transfer on item: ${sourceItem.name}`);
        }

        const destinationCandidates = await tx.stockItem.findMany({
          where: {
            propertyId: transfer.propertyId,
            warehouseId: transfer.toWarehouseId,
            isActive: true,
            OR: [
              ...(sourceItem.sku ? [{ sku: sourceItem.sku }] : []),
              { name: { equals: sourceItem.name, mode: 'insensitive' as const } },
            ],
          },
          orderBy: { updatedAt: 'desc' },
        });
        const skuMatches = sourceItem.sku
          ? destinationCandidates.filter((candidate: any) => candidate.sku === sourceItem.sku)
          : [];
        const nameMatches = destinationCandidates.filter((candidate: any) =>
          normalizeStockName(candidate.name) === normalizeStockName(sourceItem.name)
          && candidate.baseUnit === sourceItem.baseUnit,
        );
        let destItem = skuMatches.length === 1
          ? skuMatches[0]
          : skuMatches.length > 1
            ? null
            : nameMatches.length === 1
              ? nameMatches[0]
              : null;
        if (skuMatches.length > 1 || (!skuMatches.length && nameMatches.length > 1)) {
          throw new Error(`Ambiguous destination stock mapping for ${sourceItem.name}. Consolidate active destination stock records before posting this transfer.`);
        }

        // Auto-create destination item if it doesn't exist
        if (!destItem) {
          destItem = await tx.stockItem.create({
            data: {
              propertyId: transfer.propertyId,
              warehouseId: transfer.toWarehouseId,
              name: sourceItem.name,
              sku: sourceItem.sku,
              // Barcodes are unique at property level. Outlet stock rows are
              // mapped by SKU/name and must not copy the main-warehouse
              // barcode into another StockItem record.
              barcode: null,
              baseUnit: sourceItem.baseUnit,
              stockType: sourceItem.stockType,
              costPrice: sourceItem.costPrice,
              quantityOnHand: 0,
              isActive: true,
              stockUnits: {
                create: sourceItem.stockUnits.map((unit: any) => ({
                  unit: unit.unit,
                  unitsInBase: unit.unitsInBase,
                  barcode: null,
                  isPurchaseUnit: unit.isPurchaseUnit,
                  isIssueUnit: unit.isIssueUnit,
                })),
              },
            }
          });
        }

        // 1. Deduct from Source
        const updatedSource = await tx.stockItem.update({
          where: { id: sourceItem.id },
          data: { quantityOnHand: { decrement: transferQuantity } }
        });

        await tx.stockTransaction.create({
          data: {
            propertyId: transfer.propertyId,
            stockItemId: sourceItem.id,
            source: 'TRANSFER' as StockTransactionSource,
            quantity: transferQuantity * -1, // Negative for Out, always in base units
            unitCost: sourceItem.costPrice,
            quantityBefore: sourceItem.quantityOnHand,
            quantityAfter: updatedSource.quantityOnHand,
            totalValue: transferQuantity * Number(sourceItem.costPrice) * -1,
            currency,
            warehouseId: transfer.fromWarehouseId,
            transferId: transfer.id,
            operationId: `${operationId}_${item.id}_out`,
            userId: actorId,
            businessDate: property.businessDate,
          }
        });

        // 2. Add to Destination
        const updatedDest = await tx.stockItem.update({
          where: { id: destItem.id },
          data: { quantityOnHand: { increment: transferQuantity } }
        });

        await tx.stockTransaction.create({
          data: {
            propertyId: transfer.propertyId,
            stockItemId: destItem.id,
            source: 'TRANSFER' as StockTransactionSource,
            quantity: transferQuantity,
            unitCost: destItem.costPrice, // Maintain cost price across warehouse
            quantityBefore: destItem.quantityOnHand,
            quantityAfter: updatedDest.quantityOnHand,
            totalValue: transferQuantity * Number(destItem.costPrice),
            currency,
            warehouseId: transfer.toWarehouseId,
            transferId: transfer.id,
            operationId: `${operationId}_${item.id}_in`,
            userId: actorId,
            businessDate: property.businessDate,
          }
        });
      }

      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TRANSFER_STATUS.COMPLETED,
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
  static async postSale(ctx: TenantContext, posOrderId: string, actorId?: string, operationId?: string) {
    const order = await prisma.posOrder.findUnique({ where: { id: posOrderId }, select: { propertyId: true } });
    if (!order) throw new Error('POS Order not found');
    if (!ctx.propertyIds.includes(order.propertyId)) throw new Error('FORBIDDEN');

    const fallbackOpId = operationId || `op_sale_${posOrderId}`;
    return prisma.$transaction((tx: any) =>
      InventoryService.commitSaleInTransaction(tx, posOrderId, actorId || 'system', fallbackOpId)
    );
  }

  /**
   * Approve a Cost Adjustment Request
   * Revalues the inventory and creates a financial StockTransaction without changing quantity.
   */
  static async approveCostAdjustment(ctx: TenantContext, adjustmentId: string, actorId: string, operationId: string) {
    return await prisma.$transaction(async (tx: any) => {
      const adjustment = await tx.costAdjustment.findUnique({
        where: { id: adjustmentId },
        include: { stockItem: true }
      });

      if (!adjustment) throw new Error('Cost adjustment not found');
      if (!ctx.propertyIds.includes(adjustment.propertyId)) throw new Error('FORBIDDEN');
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
      if (!property?.businessDate) throw new Error('Property business date is not initialized. Cannot post adjustment.');
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
          businessDate: property.businessDate,
          notes: `Cost Revaluation: ${adjustment.reason}`
        }
      });

      return { success: true };
    });
  }

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

      const updatedStock = await tx.stockItem.update({
        where: { id: stockItem.id },
        data: { quantityOnHand: { decrement: baseQuantity } }
      });

      // 2. Audit Ledger
      await tx.stockTransaction.create({
        data: {
          propertyId: entry.propertyId,
          stockItemId: stockItem.id,
          source: 'WASTE',
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
          notes: `Waste: ${entry.reason}`
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
}
