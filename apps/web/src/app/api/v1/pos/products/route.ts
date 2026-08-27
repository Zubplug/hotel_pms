import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);

    const url = new URL(req.url);
    const propertyId = url.searchParams.get('propertyId');
    if (!propertyId) return errorResponse('BAD_REQUEST', 'Property ID is required', 400);

    const products = await prisma.posProduct.findMany({
      where: { propertyId, isActive: true },
      include: {
        category: {
          select: { id: true, name: true, productionStation: true },
        },
        modifiers: { select: { id: true } },
        recipe: { include: { versions: { where: { isActive: true }, include: { ingredients: { include: { stockItem: { select: { id: true, quantityOnHand: true, isActive: true } } } } } } } },
      },
    });

    // Compute resolved productionStation + hasModifiers so the UI doesn't need extra calls
    const enriched = products.map((p: any) => {
      const isStockControlled = p.inventoryMode === 'STOCK';
      const ingredients = p.recipe?.versions?.[0]?.ingredients || [];
      const hasInventoryMapping = ingredients.length > 0;
      const availableStock = isStockControlled && hasInventoryMapping
        ? Math.min(...ingredients.map((ingredient: any) => Number(ingredient.stockItem?.quantityOnHand || 0) / Number(ingredient.quantity || 1)))
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
      modifiers: undefined, // strip raw modifier list — only expose flag
      recipe: undefined,
      };
    });

    return successResponse(enriched);
  } catch (err) {
    console.error('[POS Products GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
