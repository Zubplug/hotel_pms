/**
 * GET /api/commerce/storefront/[slug]/promotions
 *
 * Public, unauthenticated — returns active promotion summaries for storefront
 * presentation. Validation and order placement remain authoritative at their
 * existing endpoints; this response never exposes internal usage data.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { hasPublicCommerceAccess } from '@/lib/commerce/public-access';

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const now = new Date();
    const store = await prisma.commerceStore.findUnique({
      where: { slug },
      select: { id: true, status: true, organizationId: true, propertyId: true },
    });

    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);
    if (!(await hasPublicCommerceAccess(store.organizationId, store.propertyId))) {
      return errorResponse('STORE_UNAVAILABLE', 'Online ordering is temporarily unavailable.', 503);
    }
    if (store.status !== 'ACTIVE') {
      return errorResponse('STORE_UNAVAILABLE', 'This store is not currently accepting orders.', 503);
    }

    const promotions = await prisma.commercePromotion.findMany({
      where: {
        storeId: store.id,
        isActive: true,
        validFrom: { lte: now },
        validTo: { gte: now },
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        value: true,
        minimumOrderAmount: true,
        validTo: true,
      },
      orderBy: { validTo: 'asc' },
      take: 6,
    });

    return successResponse(promotions);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
