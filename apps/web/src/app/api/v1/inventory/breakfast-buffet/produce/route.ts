import { NextRequest } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { BuffetProductionService, RecipeSelection } from '@/lib/services/buffet-production-service';

type BuffetPostBody = {
  propertyId?: string;
  outletId?: string;
  covers?: number | string;
  recipeId?: string;
  productId?: string;
  warehouseId?: string;
  businessDate?: string;
  operationId?: string;
  recipes?: RecipeSelection[];
};

type AuthenticatedUser = { id: string };

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const user = session.user as AuthenticatedUser;
    const { propertyIds } = await requireOrganizationContext(user.id);
    const body = (await req.json()) as BuffetPostBody;
    const { covers, outletId, recipeId, productId, warehouseId, businessDate, operationId, recipes } = body;
    const propertyId = body.propertyId || propertyIds[0];

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

    const selectedRecipes = Array.isArray(recipes) && recipes.length
      ? recipes
      : recipeId ? [{ recipeId, portionsPerGuest: 1 }] : [];
    if (!selectedRecipes.length && !productId) {
      return errorResponse(
        'BAD_REQUEST',
        'EXPLICIT_RECIPE_REQUIRED: A valid recipeId or productId is required for buffet production',
        400,
      );
    }

    const result = await BuffetProductionService.produceBuffetBatch({
      propertyId,
      covers: Math.floor(parsedCovers),
      outletId,
      recipeId,
      productId,
      recipes: selectedRecipes,
      warehouseId,
      businessDate,
      operationId,
      actorId: user.id,
    });

    return successResponse(result, 201);
  } catch (error: unknown) {
    console.error('[BREAKFAST_BUFFET_PRODUCE_POST]', error);
    return errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal error', 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { propertyIds } = await requireOrganizationContext((session.user as AuthenticatedUser).id);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId') || propertyIds[0];
    const outletId = searchParams.get('outletId') || undefined;
    const covers = Number(searchParams.get('covers') || '1');
    const recipeId = searchParams.get('recipeId') || undefined;
    const productId = searchParams.get('productId') || undefined;
    let recipes: RecipeSelection[] | undefined;
    const recipesParam = searchParams.get('recipes');
    if (recipesParam) {
      try {
        const parsed = JSON.parse(recipesParam);
        if (Array.isArray(parsed)) recipes = parsed;
      } catch {
        return errorResponse('BAD_REQUEST', 'Invalid production recipe selection', 400);
      }
    }

    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Property ID is required', 400);
    }

    if (!propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'Unauthorized property access', 403);
    }

    if (outletId) {
      const outlet = await prisma.posOutlet.findFirst({ where: { id: outletId, propertyId, isActive: true }, select: { id: true } });
      if (!outlet) return errorResponse('BAD_REQUEST', 'Selected outlet is not available for this property', 400);
    }

    const breakfastCategories = await prisma.productCategory.findMany({
      where: {
        isActive: true,
        outlet: { propertyId },
        ...(outletId ? { outletId } : {}),
        OR: [
          { name: { contains: 'breakfast', mode: 'insensitive' } },
          { name: { contains: 'complimentary', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });
    const breakfastCategoryIds = breakfastCategories.map((category) => category.id);
    const recipeScope = breakfastCategoryIds.length
      ? { categoryId: { in: breakfastCategoryIds } }
      : {};

    const availableRecipes = await prisma.recipe.findMany({
      where: { propertyId, isActive: true, posProduct: recipeScope },
      select: {
        id: true,
        posProduct: { select: { id: true, name: true, category: { select: { name: true, outlet: { select: { name: true } } } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!recipeId && !productId && !recipes?.length) {
      return successResponse({ recipe: null, items: [], totalEstimatedCost: 0, entitledInHouseCovers: 0, availableRecipes, breakfastCategories });
    }

    const preview = await BuffetProductionService.calculateRequisition({
      propertyId,
      covers: Math.max(1, Math.floor(covers)),
      outletId,
      recipeId,
      productId,
      recipes,
    });

    return successResponse({
      ...preview,
      availableRecipes,
      breakfastCategories,
    });
  } catch (error: unknown) {
    console.error('[BREAKFAST_BUFFET_PREVIEW_GET]', error);
    return errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal error', 500);
  }
}
