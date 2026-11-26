/**
 * GET  /api/commerce/manage/stores/[storeId]/menus/[menuId]/categories  — list categories
 * POST /api/commerce/manage/stores/[storeId]/menus/[menuId]/categories  — create category
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';
import { z } from 'zod';

type Params = { params: Promise<{ storeId: string; menuId: string }> };

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireFoodCommerceEntitlement(ctx.organizationId);
    const { storeId, menuId } = await params;

    const menu = await prisma.commerceMenu.findFirst({
      where: { id: menuId, storeId, store: { organizationId: ctx.organizationId } },
    });
    if (!menu) return errorResponse('NOT_FOUND', 'Menu not found', 404);

    const categories = await prisma.commerceCategory.findMany({
      where: { menuId },
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return successResponse(categories);
  } catch (err) {
    console.error('[commerce/manage/categories GET]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireFoodCommerceEntitlement(ctx.organizationId);
    const { storeId, menuId } = await params;

    const menu = await prisma.commerceMenu.findFirst({
      where: { id: menuId, storeId, store: { organizationId: ctx.organizationId } },
    });
    if (!menu) return errorResponse('NOT_FOUND', 'Menu not found', 404);

    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid category data', 422, parsed.error.flatten());
    }

    const category = await prisma.commerceCategory.create({
      data: { menuId, storeId, ...parsed.data },
    });

    return successResponse(category, 201);
  } catch (err) {
    console.error('[commerce/manage/categories POST]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
