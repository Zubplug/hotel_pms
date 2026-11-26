/**
 * GET  /api/commerce/manage/stores/[storeId]/promotions — list promotions
 * POST /api/commerce/manage/stores/[storeId]/promotions — create promotion
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';
import { z } from 'zod';

type Params = { params: Promise<{ storeId: string }> };

const createPromoSchema = z.object({
  code: z.string().min(2).max(32).toUpperCase(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_DELIVERY']),
  discountValue: z.number().min(0),
  minimumOrderAmount: z.number().min(0).default(0),
  maxUsageCount: z.number().min(1).optional(),
  maxUsagePerCustomer: z.number().min(1).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  isActive: z.boolean().default(true),
  description: z.string().max(200).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireFoodCommerceEntitlement(ctx.organizationId);
    const { storeId } = await params;

    const storeOk = await prisma.commerceStore.findFirst({
      where: { id: storeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!storeOk) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const promotions = await prisma.commercePromotion.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(promotions);
  } catch (err) {
    console.error('[commerce/manage/promotions GET]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireFoodCommerceEntitlement(ctx.organizationId);
    const { storeId } = await params;

    const storeOk = await prisma.commerceStore.findFirst({
      where: { id: storeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!storeOk) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const body = await req.json();
    const parsed = createPromoSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid promotion data', 422, parsed.error.flatten());
    }
    const data = parsed.data;

    // Check code uniqueness within store
    const existing = await prisma.commercePromotion.findFirst({ where: { storeId, code: data.code } });
    if (existing) return errorResponse('CONFLICT', 'Promo code already exists for this store', 409);

    const promo = await prisma.commercePromotion.create({
      data: {
        storeId,
        name: data.description?.trim() || data.code,
        code: data.code,
        type: data.discountType,
        value: data.discountValue,
        minimumOrderAmount: data.minimumOrderAmount,
        maxUsesTotal: data.maxUsageCount,
        maxUsesPerCustomer: data.maxUsagePerCustomer,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validTo: data.validTo ? new Date(data.validTo) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: data.isActive,
      },
    });

    return successResponse(promo, 201);
  } catch (err) {
    console.error('[commerce/manage/promotions POST]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
