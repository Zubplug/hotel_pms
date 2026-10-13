import { prisma } from '@hotel-pms/db';
import { getUnitConversionToBase } from '@/lib/inventory/units';
import { assertNightAuditAllowsTransaction } from '@/lib/night-audit-guard';
import { resolveBreakdownConfig } from '@/lib/room-rate-breakdown';

export interface RequisitionItem {
  stockItemId: string;
  stockItemName: string;
  sku: string;
  requiredQuantity: number;
  baseUnit: string;
  currentStock: number;
  unitCost: number;
  totalCost: number;
}

export interface CalculateRequisitionParams {
  propertyId: string;
  covers: number;
  recipeId?: string;
  productId?: string;
}

export interface ProduceBuffetParams {
  propertyId: string;
  covers: number;
  recipeId?: string;
  productId?: string;
  actorId: string;
  businessDate?: Date | string;
  warehouseId?: string;
  operationId?: string;
  reservationId?: string;
  roomNumber?: string;
}

export class BuffetProductionService {
  /**
   * Resolves the active recipe and computes the required ingredient batch
   * quantities based on covers × recipe ingredients.
   */
  static async calculateRequisition(params: CalculateRequisitionParams): Promise<{
    recipe: any;
    items: RequisitionItem[];
    totalEstimatedCost: number;
    entitledInHouseCovers?: number;
  }> {
    const { propertyId, covers, recipeId, productId } = params;

    let recipe: any = null;

    if (recipeId) {
      recipe = await prisma.recipe.findFirst({
        where: { id: recipeId, propertyId, isActive: true },
        include: {
          versions: {
            where: { isActive: true },
            include: {
              ingredients: {
                include: { stockItem: true },
              },
            },
          },
          posProduct: true,
        },
      });
    } else if (productId) {
      recipe = await prisma.recipe.findFirst({
        where: { posProductId: productId, propertyId, isActive: true },
        include: {
          versions: {
            where: { isActive: true },
            include: {
              ingredients: {
                include: { stockItem: true },
              },
            },
          },
          posProduct: true,
        },
      });
    } else {
      throw new Error(
        'EXPLICIT_RECIPE_REQUIRED: A valid recipeId or productId must be specified for buffet production.',
      );
    }

    if (!recipe) {
      throw new Error('No active breakfast recipe found for the specified identifier.');
    }

    const activeVersion = recipe.versions?.[0];
    if (!activeVersion || !activeVersion.ingredients?.length) {
      throw new Error(`Recipe "${recipe.posProduct?.name || recipe.id}" has no active version with ingredients.`);
    }

    const items: RequisitionItem[] = [];
    let totalEstimatedCost = 0;

    for (const ingredient of activeVersion.ingredients) {
      const stockItem = ingredient.stockItem;
      if (!stockItem) continue;

      const conversion = getUnitConversionToBase(
        ingredient.unitOfMeasure,
        stockItem.baseUnit,
        (stockItem.stockUnits as any) || [],
      );

      if (conversion <= 0) {
        throw new Error(
          `Unit conversion failed from ${ingredient.unitOfMeasure} to ${stockItem.baseUnit} for ingredient ${stockItem.name}.`,
        );
      }

      const requiredQuantity = Number(ingredient.quantity) * conversion * covers;
      const unitCost = Number(stockItem.costPrice || 0);
      const totalCost = Math.round(requiredQuantity * unitCost * 100) / 100;
      totalEstimatedCost += totalCost;

      items.push({
        stockItemId: stockItem.id,
        stockItemName: stockItem.name,
        sku: stockItem.sku || '',
        requiredQuantity,
        baseUnit: stockItem.baseUnit,
        currentStock: Number(stockItem.quantityOnHand || 0),
        unitCost,
        totalCost,
      });
    }

    // Calculate live entitled in-house covers for today
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { settings: true, businessDate: true },
    });

    const breakdownConfig = resolveBreakdownConfig(property?.settings as any);
    const busDate = property?.businessDate || new Date();

    const activeReservations = await prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'CHECKED_IN',
        checkIn: { lte: busDate },
        checkOut: { gt: busDate },
      },
      select: {
        id: true,
        adults: true,
        corporateAccount: { select: { ratePlan: { select: { includeFoodAllocation: true } } } },
        ratePlan: { select: { type: true, includeFoodAllocation: true } },
        reservationRooms: {
          where: { status: 'ACTIVE' },
          select: { discountAmount: true, discountPercent: true, discountApprovalId: true }
        }
      }
    });

    let entitledInHouseCovers = 0;
    for (const res of activeReservations) {
      const isCorporate = Boolean(res.corporateAccount);
      const corporatePlan = res.corporateAccount?.ratePlan || null;
      if (isCorporate && corporatePlan && !corporatePlan.includeFoodAllocation) {
        continue;
      }
      const activeRoom = res.reservationRooms[0];
      const hasDiscount = Boolean(
        activeRoom && (Number(activeRoom.discountAmount || 0) > 0 || Number(activeRoom.discountPercent || 0) > 0 || activeRoom.discountApprovalId)
      );
      if (hasDiscount && !breakdownConfig.allowComplimentaryFoodOnDiscountedRooms) {
        continue;
      }
      entitledInHouseCovers += Math.max(1, res.adults);
    }

    return {
      recipe,
      items,
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      entitledInHouseCovers,
    };
  }

  /**
   * Executes a batch production stock deduction from the kitchen warehouse.
   * Atomically decrements kitchen inventory with source 'SALE' and records
   * production traceability without generating fictitious guest tickets.
   */
  static async produceBuffetBatch(params: ProduceBuffetParams) {
    const { propertyId, covers, actorId } = params;

    if (!actorId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId)) {
      throw new Error('AUTHENTICATED_USER_REQUIRED: A valid authenticated actorId is required to post buffet production.');
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, businessDate: true, baseCurrency: true, timezone: true },
    });

    if (!property) throw new Error('Property not found');

    const businessDate = params.businessDate
      ? new Date(params.businessDate)
      : property.businessDate || new Date();
    businessDate.setUTCHours(0, 0, 0, 0);

    await assertNightAuditAllowsTransaction(propertyId, businessDate);

    const { recipe, items, totalEstimatedCost } = await this.calculateRequisition({
      propertyId,
      covers,
      recipeId: params.recipeId,
      productId: params.productId,
    });

    const opKey = params.operationId;
    if (!opKey || opKey.length < 8) {
      throw new Error('STABLE_OPERATION_ID_REQUIRED: Buffet production must include a stable operationId for retry-safe posting.');
    }

    return await prisma.$transaction(async (tx: any) => {
      // Idempotency check
      const existing = await tx.stockTransaction.findFirst({
        where: { operationId: { startsWith: opKey }, source: 'SALE' },
      });
      if (existing) {
        return {
          success: true,
          alreadyProcessed: true,
          message: 'Buffet batch production already executed.',
          covers,
          totalEstimatedCost,
          items,
        };
      }

      // Check warehouse (kitchen or specified)
      let targetWarehouseId = params.warehouseId;
      if (!targetWarehouseId) {
        const kitchenWarehouse = await tx.warehouse.findFirst({
          where: { propertyId, type: 'KITCHEN' },
          select: { id: true },
        });
        targetWarehouseId = kitchenWarehouse?.id || null;
      }

      // 1. Strict Stock Validation: Pre-validate that all required ingredients have sufficient on-hand quantity
      const stockItemMap = new Map<string, any>();
      for (const item of items) {
        const stockItem = await tx.stockItem.findUnique({
          where: { id: item.stockItemId },
          select: { id: true, name: true, quantityOnHand: true, costPrice: true, baseUnit: true },
        });

        if (!stockItem) {
          throw new Error(`Stock item ${item.stockItemName || item.stockItemId} not found.`);
        }

        const qtyOnHand = Number(stockItem.quantityOnHand || 0);
        if (qtyOnHand < item.requiredQuantity) {
          throw new Error(
            `INSUFFICIENT_STOCK: Insufficient stock for ${stockItem.name}. Required: ${item.requiredQuantity} ${stockItem.baseUnit}, Available: ${qtyOnHand} ${stockItem.baseUnit}`,
          );
        }

        stockItemMap.set(item.stockItemId, stockItem);
      }

      // 2. Atomically decrement stock and record stock transaction log
      for (const item of items) {
        const stockItem = stockItemMap.get(item.stockItemId)!;
        const qtyBefore = Number(stockItem.quantityOnHand || 0);
        const qtyAfter = qtyBefore - item.requiredQuantity;

        const updatedStock = await tx.stockItem.updateMany({
          where: { id: stockItem.id, quantityOnHand: { gte: item.requiredQuantity } },
          data: { quantityOnHand: { decrement: item.requiredQuantity } },
        });
        if (updatedStock.count !== 1) {
          throw new Error(`INSUFFICIENT_STOCK: Inventory changed during buffet production for ${stockItem.name}.`);
        }

        await tx.stockTransaction.create({
          data: {
            propertyId,
            stockItemId: stockItem.id,
            source: 'SALE',
            quantity: -item.requiredQuantity,
            unitCost: item.unitCost,
            quantityBefore: qtyBefore,
            quantityAfter: qtyAfter,
            totalValue: item.totalCost,
            currency: property.baseCurrency || 'NGN',
            businessDate,
            reference: 'BREAKFAST_BUFFET_BATCH',
            reason: 'NORMAL',
            notes: `Batch breakfast buffet production for ${covers} covers (${recipe.posProduct?.name || 'Breakfast Buffet'})`,
            operationId: `${opKey}_${stockItem.id}`,
            userId: actorId || null,
            warehouseId: targetWarehouseId,
          },
        });
      }

      // 3. Post COGS Journal Entry: Debit GL 5000 (Cost of Goods Sold), Credit GL 1300 (Kitchen Food Inventory)
      let journalEntryId: string | null = null;
      if (totalEstimatedCost > 0) {
        const cogsAccount = await tx.chartOfAccount.findUnique({
          where: { propertyId_code: { propertyId, code: '5000' } },
        });
        if (!cogsAccount) {
          throw new Error('CHART_OF_ACCOUNTS_MISSING: GL Account 5000 (Cost of Goods Sold - Food) must exist in Chart of Accounts.');
        }

        const inventoryAccount = await tx.chartOfAccount.findUnique({
          where: { propertyId_code: { propertyId, code: '1300' } },
        });
        if (!inventoryAccount) {
          throw new Error('CHART_OF_ACCOUNTS_MISSING: GL Account 1300 (Kitchen Food & Beverage Inventory) must exist in Chart of Accounts.');
        }

        const period = await tx.accountingPeriod.findFirst({
          where: { propertyId, status: 'OPEN', startDate: { lte: businessDate }, endDate: { gte: businessDate } },
          orderBy: { startDate: 'desc' },
        });

        if (!period) {
          throw new Error(`NO_OPEN_ACCOUNTING_PERIOD: An open accounting period covering business date ${businessDate.toISOString().slice(0, 10)} is required for GL journal posting.`);
        }

        const entryNumber = `JE-BUFFET-${businessDate.toISOString().slice(0, 10).replace(/-/g, '')}-${recipe.id.slice(0, 8).toUpperCase()}`;

        const journalEntry = await tx.journalEntry.create({
          data: {
            propertyId,
            periodId: period.id,
            entryNumber,
            entryDate: businessDate,
            description: `Breakfast Buffet Batch Production - ${covers} covers (${recipe.posProduct?.name || 'Breakfast Buffet'})`,
            reference: `BUFFET_PROD_${opKey}`,
            source: 'AUTO_EXPENSE',
            status: 'POSTED',
            totalDebit: totalEstimatedCost,
            totalCredit: totalEstimatedCost,
            postedBy: actorId,
            postedAt: new Date(),
            createdBy: actorId,
            lines: {
              create: [
                {
                  accountId: cogsAccount.id,
                  debit: totalEstimatedCost,
                  credit: 0,
                  description: `COGS: ${covers} buffet covers produced`,
                  sourceType: 'INVENTORY_PRODUCTION',
                },
                {
                  accountId: inventoryAccount.id,
                  debit: 0,
                  credit: totalEstimatedCost,
                  description: `Inventory reduction: ${covers} buffet covers`,
                  sourceType: 'INVENTORY_PRODUCTION',
                },
              ],
            },
          },
        });
        journalEntryId = journalEntry.id;
      }

      // 4. If tied to a specific reservation or batch claim, log in BreakfastRedemption
      if (params.reservationId) {
        await tx.breakfastRedemption.create({
          data: {
            propertyId,
            reservationId: params.reservationId,
            roomNumber: params.roomNumber || 'BUFFET',
            businessDate,
            coversRedeemed: covers,
            method: 'BUFFET_BATCH',
            serverStaffId: actorId || null,
            operationId: opKey,
          },
        });
      }

      return {
        success: true,
        operationId: opKey,
        recipeName: recipe.posProduct?.name || 'Breakfast Buffet',
        covers,
        totalEstimatedCost,
        journalEntryId,
        itemsCount: items.length,
        items,
      };
    });
  }
}
