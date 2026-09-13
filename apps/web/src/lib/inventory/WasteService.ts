import { KitchenWasteStatus, KitchenWasteReason, UnitOfMeasure } from '@hotel-pms/db';
import prisma from '@hotel-pms/db';
import { InventoryService } from './InventoryService';
import { resolveStockUnitConversion } from './UnitConversionService';

export class WasteService {
  /**
   * Submit a Kitchen Waste entry for approval
   */
  static async submitWaste({
    propertyId,
    stockItemId,
    outletId,
    quantity,
    unitOfMeasure,
    reason,
    notes,
  }: {
    propertyId: string;
    stockItemId: string;
    outletId?: string;
    quantity: number;
    unitOfMeasure: UnitOfMeasure;
    reason: KitchenWasteReason;
    notes?: string;
  }, actorId: string) {
    if (quantity <= 0) throw new Error('Waste quantity must be greater than zero');
    
    return await prisma.$transaction(async (tx) => {
      const stockItem = await tx.stockItem.findUnique({
        where: { id: stockItemId },
        select: { id: true, costPrice: true, baseUnit: true }
      });
      if (!stockItem) throw new Error('Stock item not found');

      const conversionToBase = await resolveStockUnitConversion(tx as any, stockItemId, unitOfMeasure);
      const baseQuantity = quantity * conversionToBase;
      const unitCost = Number(stockItem.costPrice);
      const totalValue = baseQuantity * unitCost;

      return await tx.kitchenWasteEntry.create({
        data: {
          propertyId,
          stockItemId,
          outletId,
          quantity,
          unitOfMeasure,
          baseQuantity,
          unitCost,
          totalValue,
          reason,
          notes,
          status: 'SUBMITTED',
          createdBy: actorId,
        }
      });
    });
  }

  /**
   * Approve and post waste to inventory. 
   * Protects against concurrent/duplicate approvals.
   */
  static async approveWaste(wasteId: string, actorId: string, operationId: string) {
    // We delegate the atomic inventory posting to InventoryService.
    // InventoryService will handle idempotent checks via StockTransaction.
    return await InventoryService.postWaste(wasteId, actorId, operationId);
  }

  /**
   * Reject a submitted waste entry.
   */
  static async rejectWaste(wasteId: string, actorId: string) {
    return await prisma.$transaction(async (tx) => {
      const entry = await tx.kitchenWasteEntry.findUnique({ where: { id: wasteId } });
      if (!entry) throw new Error('Waste entry not found');
      if (entry.status !== 'SUBMITTED') throw new Error('Only SUBMITTED waste can be rejected');

      return await tx.kitchenWasteEntry.update({
        where: { id: wasteId },
        data: {
          status: 'REJECTED',
          approvedBy: actorId, // Log who rejected it in the approvedBy field, or we can use another field if it existed.
        }
      });
    });
  }
}
