/**
 * PATCH  /api/commerce/manage/stores/[storeId]/products/[productId]
 * DELETE /api/commerce/manage/stores/[storeId]/products/[productId]
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';
import { z } from 'zod';

type Params = { params: Promise<{ storeId: string; productId: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(600).nullish(),
  price: z.number().min(0).optional(),
  compareAtPrice: z.number().min(0).nullish(),
  imageUrl: z.string().url().nullish(),
  isActive: z.boolean().optional(),
  prepTimeMinutes: z.number().min(0).nullish(),
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  categoryId: z.string().optional(),
  stockCount: z.number().min(0).nullish(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireFoodCommerceEntitlement(ctx.organizationId);
    const { storeId, productId } = await params;

    const product = await prisma.commerceProduct.findFirst({
      where: { id: productId, storeId, store: { organizationId: ctx.organizationId } },
    });
    if (!product) return errorResponse('NOT_FOUND', 'Product not found', 404);

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid product data', 422, parsed.error.flatten());
    }

    const updated = await prisma.commerceProduct.update({
      where: { id: productId },
      data: parsed.data,
      include: {
        modifierGroups: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
        category: { select: { id: true, name: true } },
      },
    });

    return successResponse(updated);
  } catch (err) {
    console.error('[commerce/manage/products PATCH]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireFoodCommerceEntitlement(ctx.organizationId);
    const { storeId, productId } = await params;

    const product = await prisma.commerceProduct.findFirst({
      where: { id: productId, storeId, store: { organizationId: ctx.organizationId } },
    });
    if (!product) return errorResponse('NOT_FOUND', 'Product not found', 404);

    // Soft delete — mark inactive rather than hard delete (preserves order history)
    await prisma.commerceProduct.update({
      where: { id: productId },
      data: { isActive: false },
    });

    return successResponse({ deleted: true });
  } catch (err) {
    console.error('[commerce/manage/products DELETE]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
