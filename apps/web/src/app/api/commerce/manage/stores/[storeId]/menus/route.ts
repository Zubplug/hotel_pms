/**
 * GET  /api/commerce/manage/stores/[storeId]/menus   — list menus
 * POST /api/commerce/manage/stores/[storeId]/menus   — create menu
 * GET  /api/commerce/manage/stores/[storeId]/menus/[menuId]/categories — categories
 * POST /api/commerce/manage/stores/[storeId]/menus/[menuId]/categories — create category
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireEntitlement } from '@/lib/auth/entitlement';
import { z } from 'zod';

type Params = { params: Promise<{ storeId: string }> };

const createMenuSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().default(false),
  availableFrom: z.string().nullish(), // "08:00"
  availableTo: z.string().nullish(),   // "22:00"
  availableDays: z.array(z.enum(['MON','TUE','WED','THU','FRI','SAT','SUN'])).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'ADDON_FOOD_COMMERCE');
    const { storeId } = await params;

    const storeOk = await prisma.commerceStore.findFirst({
      where: { id: storeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!storeOk) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const menus = await prisma.commerceMenu.findMany({
      where: { storeId },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { products: { where: { isActive: true } } } },
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return successResponse(menus);
  } catch (err) {
    console.error('[commerce/manage/menus GET]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'ADDON_FOOD_COMMERCE');
    const { storeId } = await params;

    const storeOk = await prisma.commerceStore.findFirst({
      where: { id: storeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!storeOk) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const body = await req.json();
    const parsed = createMenuSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid menu data', 422, parsed.error.flatten());
    }
    const data = parsed.data;

    // If marking as default, unset current default first
    if (data.isDefault) {
      await prisma.commerceMenu.updateMany({ where: { storeId, isDefault: true }, data: { isDefault: false } });
    }

    const menu = await prisma.commerceMenu.create({
      data: {
        storeId,
        name: data.name,
        description: data.description,
        isDefault: data.isDefault,
        availableFrom: data.availableFrom,
        availableTo: data.availableTo,
        availableDays: data.availableDays ?? [],
        isActive: true,
      },
    });

    return successResponse(menu, 201);
  } catch (err) {
    console.error('[commerce/manage/menus POST]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
