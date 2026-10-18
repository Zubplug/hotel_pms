import { prisma } from '@hotel-pms/db';
import { getUnitConversionToBase } from '@/lib/inventory/units';
import { assertNightAuditAllowsTransaction } from '@/lib/night-audit-guard';
import { resolveBreakdownConfig } from '@/lib/room-rate-breakdown';
import { kitchenServiceOutletId } from '@/lib/inventory/kitchen-routing';

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
  recipes?: RecipeSelection[];
}

export interface RecipeSelection {
  recipeId: string;
  portionsPerGuest: number;
}

export interface ProduceBuffetParams {
  propertyId: string;
  covers: number;
  recipeId?: string;
  productId?: string;
  recipes?: RecipeSelection[];
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
    recipes: any[];
    items: RequisitionItem[];
    totalEstimatedCost: number;
    entitledInHouseCovers?: number;
  }> {
    const { propertyId, covers, recipeId, productId } = params;
    const selections = (params.recipes?.length
      ? params.recipes
      : recipeId
        ? [{ recipeId, portionsPerGuest: 1 }]
        : []).map((selection) => ({
      recipeId: selection.recipeId,
      portionsPerGuest: Math.max(0.01, Number(selection.portionsPerGuest) || 1),
    }));

    let recipes: any[] = [];
    if (selections.length) {
      recipes = await Promise.all(selections.map((selection) => prisma.recipe.findFirst({
        where: { id: selection.recipeId, propertyId, isActive: true },
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
      })));
      if (recipes.some((candidate) => !candidate)) {
        throw new Error('One or more selected production recipes could not be found or are inactive.');
      }
    } else if (productId) {
      const productRecipe = await prisma.recipe.findFirst({
        where: { posProductId: productId, propertyId, isActive: true },
        include: {
          versions: { where: { isActive: true }, include: { ingredients: { include: { stockItem: true } } } },
          posProduct: true,
        },
      });
      if (productRecipe) {
        recipes = [productRecipe];
        selections.push({ recipeId: productRecipe.id, portionsPerGuest: 1 });
      }
    } else {
      throw new Error(
        'EXPLICIT_RECIPE_REQUIRED: At least one valid production recipe must be specified for buffet production.',
      );
    }

    if (!recipes.length) {
      throw new Error('No active breakfast production recipes found for the specified identifiers.');
    }

    const itemMap = new Map<string, RequisitionItem>();
    let totalEstimatedCost = 0;

    for (let index = 0; index < recipes.length; index += 1) {
      const recipe = recipes[index];
      const activeVersion = recipe.versions?.[0];
      if (!activeVersion || !activeVersion.ingredients?.length) {
        throw new Error(`Recipe "${recipe.posProduct?.name || recipe.id}" has no active version with ingredients.`);
      }
      const portionsPerGuest = selections[index]?.portionsPerGuest || 1;
      for (const ingredient of activeVersion.ingredients) {
        const stockItem = ingredient.stockItem;
        if (!stockItem) continue;
        const conversion = getUnitConversionToBase(ingredient.unitOfMeasure, stockItem.baseUnit, (stockItem.stockUnits as any) || []);
        if (conversion <= 0) throw new Error(`Unit conversion failed from ${ingredient.unitOfMeasure} to ${stockItem.baseUnit} for ingredient ${stockItem.name}.`);
        const requiredQuantity = Number(ingredient.quantity) * conversion * covers * portionsPerGuest;
        const existing = itemMap.get(stockItem.id);
        const unitCost = Number(stockItem.costPrice || 0);
        const totalCost = requiredQuantity * unitCost;
        itemMap.set(stockItem.id, existing ? {
          ...existing,
          requiredQuantity: existing.requiredQuantity + requiredQuantity,
          totalCost: existing.totalCost + totalCost,
        } : {
          stockItemId: stockItem.id,
          stockItemName: stockItem.name,
          sku: stockItem.sku || '',
          requiredQuantity,
          baseUnit: stockItem.baseUnit,
          currentStock: Number(stockItem.quantityOnHand || 0),
          unitCost,
          totalCost,
        });
        totalEstimatedCost += totalCost;
      }
    }

    const items = [...itemMap.values()].map((item) => ({
      ...item,
      requiredQuantity: Math.round(item.requiredQuantity * 10000) / 10000,
      totalCost: Math.round(item.totalCost * 100) / 100,
    }));

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
      recipe: recipes[0],
      recipes,
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
      select: { id: true, businessDate: true, baseCurrency: true, timezone: true, settings: true },
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
      recipes: params.recipes,
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

      // Buffet production consumes the configured kitchen-service stock. A
      // caller may explicitly provide a warehouse for a controlled batch,
      // otherwise prefer the warehouse attached to kitchenServiceOutletId.
      let targetWarehouseId = params.warehouseId;
      if (!targetWarehouseId) {
        const configuredKitchenOutletId = kitchenServiceOutletId(property.settings as any);
        const kitchenWarehouse = configuredKitchenOutletId
          ? await tx.warehouse.findUnique({
            where: { posOutletId: configuredKitchenOutletId },
            select: { id: true },
          })
          : await tx.warehouse.findFirst({
            where: { propertyId, type: 'KITCHEN' },
            select: { id: true },
          });
        targetWarehouseId = kitchenWarehouse?.id || null;
      }
      if (!targetWarehouseId) {
        throw new Error('KITCHEN_WAREHOUSE_NOT_CONFIGURED: Configure a kitchen service warehouse before posting buffet production.');
      }

      const sourceStockItems = await tx.stockItem.findMany({
        where: { id: { in: items.map((item) => item.stockItemId) }, propertyId },
        select: { id: true, name: true, sku: true, barcode: true },
      });
      const targetStockItems = await tx.stockItem.findMany({
        where: { propertyId, warehouseId: targetWarehouseId, isActive: true },
        select: { id: true, name: true, sku: true, barcode: true, warehouseId: true },
      });

      // Recipe ingredients may reference a main-warehouse template item. Map
      // that template to the active item in the production warehouse by
      // barcode, SKU, or normalized name before touching quantityOnHand.
      const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
      const resolvedStockItemIds = new Map<string, string>();
      for (const item of items) {
        if (resolvedStockItemIds.has(item.stockItemId)) continue;
        const source = sourceStockItems.find((candidate: any) => candidate.id === item.stockItemId);
        if (!source) throw new Error(`Stock item ${item.stockItemName || item.stockItemId} not found.`);

        const matches = targetStockItems.filter((candidate: any) =>
          (source.barcode && candidate.barcode === source.barcode) ||
          (source.sku && candidate.sku === source.sku) ||
          normalizeName(candidate.name) === normalizeName(source.name),
        );
        const distinctMatches: any[] = Array.from(new Map<string, any>(matches.map((match: any) => [match.id, match])).values());
        if (distinctMatches.length !== 1) {
          throw new Error(
            distinctMatches.length === 0
              ? `${source.name} is not provisioned in the buffet production warehouse.`
              : `Ambiguous buffet stock mapping for ${source.name}. Consolidate active stock records in the production warehouse.`,
          );
        }
        resolvedStockItemIds.set(item.stockItemId, distinctMatches[0].id);
      }

      // 1. Strict Stock Validation: Pre-validate that all required ingredients have sufficient on-hand quantity
      const stockItemMap = new Map<string, any>();
      for (const item of items) {
        const targetStockItemId = resolvedStockItemIds.get(item.stockItemId)!;
        const requiredForTarget = (stockItemMap.get(targetStockItemId)?.requiredQuantity || 0) + item.requiredQuantity;
        const stockItem = await tx.stockItem.findUnique({
          where: { id: targetStockItemId },
          select: { id: true, name: true, quantityOnHand: true, costPrice: true, baseUnit: true },
        });

        if (!stockItem) {
          throw new Error(`Stock item ${item.stockItemName || item.stockItemId} not found.`);
        }

        const qtyOnHand = Number(stockItem.quantityOnHand || 0);
        if (qtyOnHand < requiredForTarget) {
          throw new Error(
            `INSUFFICIENT_STOCK: Insufficient stock for ${stockItem.name}. Required: ${requiredForTarget} ${stockItem.baseUnit}, Available: ${qtyOnHand} ${stockItem.baseUnit}`,
          );
        }

        stockItemMap.set(targetStockItemId, { ...stockItem, requiredQuantity: requiredForTarget });
      }

      // 2. Atomically decrement stock and record stock transaction log
      for (const stockItem of stockItemMap.values()) {
        const qtyBefore = Number(stockItem.quantityOnHand || 0);
        const requiredQuantity = stockItem.requiredQuantity;
        const qtyAfter = qtyBefore - requiredQuantity;

        const updatedStock = await tx.stockItem.updateMany({
          where: { id: stockItem.id, quantityOnHand: { gte: requiredQuantity } },
          data: { quantityOnHand: { decrement: requiredQuantity } },
        });
        if (updatedStock.count !== 1) {
          throw new Error(`INSUFFICIENT_STOCK: Inventory changed during buffet production for ${stockItem.name}.`);
        }

        await tx.stockTransaction.create({
          data: {
            propertyId,
            stockItemId: stockItem.id,
            source: 'SALE',
            quantity: -requiredQuantity,
            unitCost: Number(stockItem.costPrice || 0),
            quantityBefore: qtyBefore,
            quantityAfter: qtyAfter,
            totalValue: requiredQuantity * Number(stockItem.costPrice || 0),
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
