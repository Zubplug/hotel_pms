import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from "@/lib/organization-access";
import { isKitchenProductionStation, kitchenServiceOutletId } from '@/lib/inventory/kitchen-routing';
import { getUnitConversionToBase } from '@/lib/inventory/units';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const url = new URL(req.url);
    const requestedPropertyId = url.searchParams.get('propertyId');
    const outletId = url.searchParams.get('outletId');

    const allowedPropertyIds = ctx.propertyIds as string[];

    if (requestedPropertyId && !allowedPropertyIds.includes(requestedPropertyId) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const propertyIdsToQuery = requestedPropertyId ? [requestedPropertyId] : allowedPropertyIds;
    const outletWarehouse = outletId
      ? await prisma.warehouse.findUnique({ where: { posOutletId: outletId }, select: { id: true } })
      : null;

    const products = await prisma.posProduct.findMany({
      where: { 
        propertyId: { in: propertyIdsToQuery }, 
        ...(outletId ? { category: { outletId } } : {}),
        // include inactive if specifically requested? Usually POS wants active, but menu manager might want all.
        // Let's pass `all=true` to include inactive.
      ...(url.searchParams.get('all') === 'true' ? {} : { isActive: true })
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: {
        category: {
          select: { id: true, name: true, productionStation: true, outlet: { select: { id: true, name: true } } },
        },
        modifiers: { select: { id: true, name: true, price: true, isActive: true, stockItemId: true, quantity: true, unitOfMeasure: true, groupName: true, groupRequired: true, groupMaxSelect: true } },
      recipe: { include: { versions: { where: { isActive: true }, include: { ingredients: { include: { stockItem: { select: { id: true, name: true, sku: true, barcode: true, stockType: true, baseUnit: true, stockUnits: true, quantityOnHand: true, isActive: true } } } } } } } },
      },
    });

    const properties = await prisma.property.findMany({ where: { id: { in: propertyIdsToQuery } }, select: { id: true, settings: true } });
    const kitchenOutletIds = properties.map(property => kitchenServiceOutletId(property.settings)).filter(Boolean) as string[];
    const kitchenWarehouses = kitchenOutletIds.length
      ? await prisma.warehouse.findMany({ where: { posOutletId: { in: kitchenOutletIds } }, select: { id: true, posOutletId: true } })
      : [];
    const productOutletIds = [...new Set(products.map((product) => product.category?.outlet?.id).filter(Boolean))] as string[];
    const outletWarehouses = productOutletIds.length
      ? await prisma.warehouse.findMany({ where: { posOutletId: { in: productOutletIds } }, select: { id: true, posOutletId: true } })
      : [];
    const targetWarehouseIds = [outletWarehouse?.id, ...outletWarehouses.map(warehouse => warehouse.id), ...kitchenWarehouses.map(warehouse => warehouse.id)].filter(Boolean) as string[];
    const targetStockItems = targetWarehouseIds.length
      ? await prisma.stockItem.findMany({ where: { propertyId: { in: propertyIdsToQuery }, warehouseId: { in: targetWarehouseIds }, isActive: true }, select: { name: true, sku: true, barcode: true, baseUnit: true, warehouseId: true, quantityOnHand: true } })
      : [];

    // Compute resolved productionStation + hasModifiers so the UI doesn't need extra calls
    const enriched = products.map((p: any) => {
      const isStockControlled = p.inventoryMode === 'STOCK';
      const ingredients = p.recipe?.versions?.[0]?.ingredients || [];
      const hasInventoryMapping = ingredients.length > 0;
      const resolvedStation = p.productionStation ?? p.category?.productionStation ?? 'KITCHEN';
      const availabilityIssues: Array<Record<string, unknown>> = [];
      const availableStock = isStockControlled && ingredients.length > 0
        ? Math.min(...ingredients.map((ingredient: any) => {
          const template = ingredient.stockItem;
          if (!template) {
            availabilityIssues.push({ code: 'MISSING_STOCK_DEFINITION', ingredientId: ingredient.id, name: ingredient.name || 'Unnamed ingredient' });
            return 0;
          }
          if (!template.isActive) {
            availabilityIssues.push({ code: 'INACTIVE_STOCK_DEFINITION', ingredientId: ingredient.id, name: template.name });
            return 0;
          }
          const property = properties.find(candidate => candidate.id === p.propertyId);
          const kitchenOutletId = property ? kitchenServiceOutletId(property.settings) : null;
          const kitchenWarehouseId = kitchenWarehouses.find(warehouse => warehouse.posOutletId === kitchenOutletId)?.id;
          const productOutletId = p.category?.outlet?.id || outletId;
          const productOutletWarehouseId = outletWarehouses.find(warehouse => warehouse.posOutletId === productOutletId)?.id;
          const targetWarehouseId = isKitchenProductionStation(resolvedStation) ? kitchenWarehouseId : (outletWarehouse?.id || productOutletWarehouseId);
          const conversion = getUnitConversionToBase(ingredient.unitOfMeasure, template.baseUnit, template.stockUnits || []);
          if (conversion <= 0) {
            availabilityIssues.push({ code: 'MISSING_CONVERSION', ingredientId: ingredient.id, name: template.name, fromUnit: ingredient.unitOfMeasure, toUnit: template.baseUnit });
            return 0;
          }
          const target = targetStockItems.find(item => item.warehouseId === targetWarehouseId &&
            ((template?.barcode && item.barcode === template.barcode) ||
             (template?.sku && item.sku === template.sku) ||
             item.name.trim().toLowerCase() === template?.name?.trim().toLowerCase()));
          if (!target) {
            availabilityIssues.push({ code: 'MISSING_TARGET_STOCK', ingredientId: ingredient.id, name: template.name, warehouseId: targetWarehouseId || null });
            return 0;
          }
          const requiredBaseQuantity = Number(ingredient.quantity || 0) * conversion;
          const available = requiredBaseQuantity > 0 ? Number(target.quantityOnHand || 0) / requiredBaseQuantity : 0;
          if (Number(target.quantityOnHand || 0) <= 0) {
            availabilityIssues.push({ code: 'ZERO_STOCK', ingredientId: ingredient.id, name: template.name, warehouseId: target.warehouseId });
          } else if (available < 1) {
            availabilityIssues.push({ code: 'INSUFFICIENT_STOCK', ingredientId: ingredient.id, name: template.name, warehouseId: target.warehouseId, availableServings: Math.max(0, Math.floor(available)) });
          }
          return available;
        }))
        : null;
      const hasMappingIssue = availabilityIssues.some((issue) => ['MISSING_STOCK_DEFINITION', 'INACTIVE_STOCK_DEFINITION', 'MISSING_TARGET_STOCK', 'MISSING_CONVERSION'].includes(String(issue.code)));
      const outOfStock = isStockControlled && (!hasInventoryMapping || availableStock! <= 0 || hasMappingIssue);
      return {
      ...p,
      hasModifiers: p.modifiers.length > 0,
      inventoryMode: p.inventoryMode,
      hasInventoryMapping,
      availableStock: availableStock === null ? null : Math.max(0, Math.floor(availableStock)),
      stockStatus: !isStockControlled ? 'NON_STOCK' : !hasInventoryMapping || hasMappingIssue ? 'UNMAPPED' : outOfStock ? 'OUT_OF_STOCK' : availableStock! <= 5 ? 'LOW_STOCK' : 'IN_STOCK',
      availabilityIssues,
      // Product-level override wins; fall back to category default
      resolvedStation,
      // Keep modifier details available to the menu-management screen. POS
      // clients already receive the same product projection and use these
      // fields when building modifier choices.
      recipe: undefined,
      stockItems: undefined,
      };
    });

    return successResponse(enriched);
  } catch (err) {
    console.error('[POS Products GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
