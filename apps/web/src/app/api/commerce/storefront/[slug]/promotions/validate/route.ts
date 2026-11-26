/**
 * POST /api/commerce/storefront/[slug]/promotions/validate
 *
 * Public, unauthenticated — validates a promo code and returns its effect.
 * Does not consume the promo (no usedCount increment).
 * Used by the cart UI to show discount preview before checkout.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { z } from 'zod';
import { hasPublicCommerceAccess } from '@/lib/commerce/public-access';

type Params = { params: Promise<{ slug: string }> };

const schema = z.object({
  code: z.string().min(1).max(50),
  orderSubtotal: z.number().positive(),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;

    const store = await prisma.commerceStore.findUnique({
      where: { slug },
      select: { id: true, status: true, organizationId: true, propertyId: true },
    });
    if (!store || store.status !== 'ACTIVE') {
      return errorResponse('NOT_FOUND', 'Store not found', 404);
    }
    if (!(await hasPublicCommerceAccess(store.organizationId, store.propertyId))) {
      return errorResponse('STORE_UNAVAILABLE', 'Online ordering is temporarily unavailable.', 503);
    }

    const body = await req.json();
    const { code, orderSubtotal } = schema.parse(body);

    const promo = await prisma.commercePromotion.findFirst({
      where: {
        storeId: store.id,
        code: code.toUpperCase().trim(),
        isActive: true,
        validFrom: { lte: new Date() },
        validTo: { gte: new Date() },
      },
    });

    if (!promo) {
      return errorResponse('INVALID_PROMO', 'This promo code is invalid or has expired.', 422);
    }

    if (promo.maxUsesTotal && promo.usedCount >= promo.maxUsesTotal) {
      return errorResponse('PROMO_EXHAUSTED', 'This promo code has reached its usage limit.', 422);
    }

    if (promo.minimumOrderAmount && orderSubtotal < Number(promo.minimumOrderAmount)) {
      return errorResponse(
        'BELOW_PROMO_MINIMUM',
        `This promo requires a minimum order of ${Number(promo.minimumOrderAmount).toLocaleString()}.`,
        422,
        { minimumOrderAmount: promo.minimumOrderAmount },
      );
    }

    // Calculate preview discount
    let discountAmount = 0;
    let discountDescription = '';

    if (promo.type === 'PERCENTAGE') {
      discountAmount = orderSubtotal * (Number(promo.value) / 100);
      discountDescription = `${Number(promo.value)}% off`;
    } else if (promo.type === 'FLAT') {
      discountAmount = Math.min(Number(promo.value), orderSubtotal);
      discountDescription = `Flat discount`;
    } else if (promo.type === 'FREE_DELIVERY') {
      discountDescription = 'Free delivery';
    } else if (promo.type === 'BUY_X_GET_Y') {
      discountDescription = promo.name;
    }

    return successResponse({
      valid: true,
      promotionId: promo.id,
      code: promo.code,
      name: promo.name,
      type: promo.type,
      discountAmount,
      discountDescription,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'ZodError') {
      return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422);
    }
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
