import prisma, { PurchaseOrderStatus, UnitOfMeasure } from '@hotel-pms/db';
import { PO_STATUS, GRN_STATUS } from './types';
import { resolveStockUnitConversion } from '@/lib/inventory/UnitConversionService';

export class ProcurementService {
  /**
   * Create a new Purchase Order
   */
  static async createPO({ propertyId, supplierId, items, expectedDate, notes }: any, actorId: string) {
    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Missing required fields');
    }

    return await prisma.$transaction(async (tx) => {
      const count = await tx.purchaseOrder.count({ where: { propertyId } });
      const poNumber = `PO-${String(count + 1).padStart(5, '0')}`;

      let totalAmount = 0;
      const stockItemIds = items.map((item: any) => item.stockItemId).filter(Boolean);
      const stockItems = await tx.stockItem.findMany({ where: { id: { in: stockItemIds }, propertyId, isActive: true }, select: { id: true } });
      const validStockItemIds = new Set(stockItems.map((item) => item.id));

      const poItems = [];
      for (const item of items) {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const amount = quantity * unitPrice;
        const unitOfMeasure = String(item.unitOfMeasure || item.uom || '').toUpperCase() as UnitOfMeasure;
        
        if (!Object.values(UnitOfMeasure).includes(unitOfMeasure)) {
          throw new Error(`Invalid unit of measure for ${item.description || 'line item'}`);
        }
        if (!item.stockItemId || !validStockItemIds.has(item.stockItemId)) {
          throw new Error('Each PO line must reference an active stock item in this property');
        }
        totalAmount += amount;
        
        const conversionToBase = await resolveStockUnitConversion(tx as any, item.stockItemId, unitOfMeasure);
        
        poItems.push({
          stockItemId: item.stockItemId,
          description: item.description,
          quantity,
          unitOfMeasure,
          unitPrice,
          totalPrice: amount,
          conversionToBase,
        });
      }

      return await tx.purchaseOrder.create({
        data: {
          poNumber,
          propertyId,
          supplierId,
          status: PO_STATUS.DRAFT,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          notes,
          totalAmount,
          createdBy: actorId,
          items: {
            create: poItems,
          },
        },
        include: {
          items: true,
        },
      });
    });
  }

  /**
   * Submit a PO for approval.
   */
  static async submitPO(poId: string, actorId: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new Error('Purchase Order not found');
    if (po.status !== PO_STATUS.DRAFT) throw new Error('Only DRAFT POs can be submitted');

    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PO_STATUS.SUBMITTED,
        updatedBy: actorId,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Approve a PO. 
   * Note: Permissions should be validated in the API route before calling this.
   */
  static async approvePO(poId: string, actorId: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new Error('Purchase Order not found');
    if (po.status !== PO_STATUS.SUBMITTED) throw new Error('Only SUBMITTED POs can be approved');

    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PO_STATUS.APPROVED,
        updatedBy: actorId,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Reject a PO.
   */
  static async rejectPO(poId: string, actorId: string, reason: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new Error('Purchase Order not found');
    if (po.status !== PO_STATUS.SUBMITTED) throw new Error('Only SUBMITTED POs can be rejected');

    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PO_STATUS.REJECTED,
        rejectedBy: actorId,
        rejectedAt: new Date(),
        rejectedReason: reason,
        updatedBy: actorId,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Cancel an approved PO.
   */
  static async cancelPO(poId: string, actorId: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new Error('Purchase Order not found');
    if (po.status !== PO_STATUS.APPROVED) throw new Error('Only APPROVED POs can be cancelled');

    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PO_STATUS.CANCELLED,
        cancelledBy: actorId,
        cancelledAt: new Date(),
        updatedBy: actorId,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Generate a DRAFT GRN from an Approved PO.
   * Items provided should be the quantities physically received.
   */
  static async createGRN(
    poId: string, 
    actorId: string, 
    items: { poItemId: string, receivedQty: number, unitCost: number }[],
    deliveryNoteRef?: string
  ) {
    return await prisma.$transaction(async (tx: any) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: { items: true }
      });

      if (!po) throw new Error('Purchase Order not found');
      if (po.status !== PO_STATUS.APPROVED && po.status !== PO_STATUS.PARTIALLY_RECEIVED) {
        throw new Error('PO must be APPROVED or PARTIALLY_RECEIVED to create a GRN');
      }

      const validItems = [];
      const seenPoItems = new Set<string>();
      for (const input of items) {
        const receivedQty = Number(input.receivedQty);
        const unitCost = Number(input.unitCost);
        if (!Number.isFinite(receivedQty) || receivedQty < 0 || !Number.isFinite(unitCost) || unitCost < 0) {
          throw new Error('Received quantity and unit cost must be valid non-negative numbers');
        }
        if (receivedQty === 0) continue;

        const poItem = po.items.find((i: any) => i.id === input.poItemId);
        if (!poItem) throw new Error(`PO Item ${input.poItemId} not found on this PO`);
        if (seenPoItems.has(input.poItemId)) throw new Error(`PO Item ${input.poItemId} was provided more than once`);
        if (!poItem.stockItemId) throw new Error(`PO Item ${input.poItemId} is missing a stockItemId`);
        
        const remainingQty = Number(poItem.quantity) - Number(poItem.receivedQty);
        if (receivedQty > remainingQty) {
          throw new Error(`Cannot receive ${receivedQty} for ${poItem.description}. Only ${remainingQty} remaining.`);
        }

        const conversionToBase = Number(poItem.conversionToBase || 1);
        validItems.push({
          stockItemId: poItem.stockItemId,
          description: poItem.description,
          receivedQty,
          unitOfMeasure: poItem.unitOfMeasure,
          unitCost,
          baseReceivedQty: receivedQty * conversionToBase,
          baseUnitCost: conversionToBase > 0 ? unitCost / conversionToBase : unitCost,
        });
        seenPoItems.add(input.poItemId);
      }

      if (validItems.length === 0) {
        throw new Error('Cannot create an empty GRN. No valid received quantities provided.');
      }
      const grnCount = await tx.goodsReceivedNote.count({ where: { propertyId: po.propertyId } });
      const grnNumber = `GRN-${String(grnCount + 1).padStart(5, '0')}`;

      const grn = await tx.goodsReceivedNote.create({
        data: {
          propertyId: po.propertyId,
          purchaseOrderId: po.id,
          grnNumber,
          status: GRN_STATUS.DRAFT,
          deliveryNoteRef,
          receivedDate: new Date(),
          createdBy: actorId,
          items: {
            create: validItems
          }
        },
        include: { items: true }
      });

      return { success: true, grn };
    });
  }
}
