import { NextRequest } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { BuffetProductionService } from '@/lib/services/buffet-production-service';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    const body = await req.json();
    let { propertyId, covers, recipeId, productId, warehouseId, businessDate, operationId } = body;

    propertyId = propertyId || propertyIds[0];
    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Property ID is required', 400);
    }

    if (!propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'Unauthorized property access', 403);
    }

    const parsedCovers = Number(covers);
    if (isNaN(parsedCovers) || parsedCovers <= 0) {
      return errorResponse('BAD_REQUEST', 'Covers must be a positive integer', 400);
    }
    if (typeof operationId !== 'string' || operationId.length < 8) {
      return errorResponse('BAD_REQUEST', 'A stable operationId is required for retry-safe production posting', 400);
    }

    if (!recipeId && !productId) {
      return errorResponse(
        'BAD_REQUEST',
        'EXPLICIT_RECIPE_REQUIRED: A valid recipeId or productId is required for buffet production',
        400,
      );
    }

    const result = await BuffetProductionService.produceBuffetBatch({
      propertyId,
      covers: Math.floor(parsedCovers),
      recipeId: targetRecipeId,
      productId,
      warehouseId,
      businessDate,
      operationId,
      actorId: (session.user as any).id,
    });

    return successResponse(result, 201);
  } catch (error: any) {
    console.error('[BREAKFAST_BUFFET_PRODUCE_POST]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Internal error', 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId') || propertyIds[0];
    const covers = Number(searchParams.get('covers') || '1');
    const recipeId = searchParams.get('recipeId') || undefined;
    const productId = searchParams.get('productId') || undefined;

    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Property ID is required', 400);
    }

    if (!propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'Unauthorized property access', 403);
    }

    const availableRecipes = await prisma.recipe.findMany({
      where: { propertyId, isActive: true },
      select: {
        id: true,
        posProduct: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!recipeId && !productId) {
      return successResponse({ recipe: null, items: [], totalEstimatedCost: 0, entitledInHouseCovers: 0, availableRecipes });
    }

    const preview = await BuffetProductionService.calculateRequisition({
      propertyId,
      covers: Math.max(1, Math.floor(covers)),
      recipeId,
      productId,
    });

    return successResponse({
      ...preview,
      availableRecipes,
    });
  } catch (error: any) {
    console.error('[BREAKFAST_BUFFET_PREVIEW_GET]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Internal error', 500);
  }
}
