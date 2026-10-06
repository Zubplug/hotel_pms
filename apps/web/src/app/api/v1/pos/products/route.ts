import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from "@/lib/organization-access";

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
        modifiers: { select: { id: true, name: true, price: true, isActive: true, quantity: true, unitOfMeasure: true, groupName: true, groupRequired: true, groupMaxSelect: true } },
        recipe: { include: { versions: { where: { isActive: true }, include: { ingredients: { include: { stockItem: { select: { id: true, name: true, sku: true, barcode: true, quantityOnHand: true, isActive: true } } } } } } } },
      },
    });

    // Compute resolved productionStation + hasModifiers so the UI doesn't need extra calls
    const enriched = products.map((p: any) => {
      const isStockControlled = p.inventoryMode === 'STOCK';
      const ingredients = p.recipe?.versions?.[0]?.ingredients || [];
      const hasInventoryMapping = ingredients.length > 0;
      const availableStock = isStockControlled && ingredients.length > 0
        ? Math.min(...ingredients.map((ingredient: any) => {
          const template = ingredient.stockItem;
          // Without p.stockItems, we default to the template's quantity in the main warehouse.
          return Number(template?.quantityOnHand || 0) / Number(ingredient.quantity || 1);
        }))
        : null;
      const outOfStock = isStockControlled && (!hasInventoryMapping || availableStock! <= 0 || ingredients.some((ingredient: any) => !ingredient.stockItem?.isActive));
      return {
      ...p,
      hasModifiers: p.modifiers.length > 0,
      inventoryMode: p.inventoryMode,
      hasInventoryMapping,
      availableStock: availableStock === null ? null : Math.max(0, Math.floor(availableStock)),
      stockStatus: !isStockControlled ? 'NON_STOCK' : !hasInventoryMapping ? 'UNMAPPED' : outOfStock ? 'OUT_OF_STOCK' : availableStock! <= 5 ? 'LOW_STOCK' : 'IN_STOCK',
      // Product-level override wins; fall back to category default
      resolvedStation: p.productionStation ?? p.category?.productionStation ?? 'KITCHEN',
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
