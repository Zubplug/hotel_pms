/**
 * GET /api/commerce/storefront/[slug]
 *
 * Public, unauthenticated — returns store branding, config and status.
 * Used by the embed widget and any website to render the storefront shell.
 *
 * Entitlement check: CommerceStore.status must be ACTIVE.
 * If SUSPENDED (entitlement lapsed), returns 503 with a friendly message.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { hasPublicCommerceAccess } from '@/lib/commerce/public-access';
import { getPropertyPaymentAccount } from '@/lib/payment-providers/property-account';

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;

    const store = await prisma.commerceStore.findUnique({
      where: { slug },
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        slug: true,
        name: true,
        description: true,
        logoUrl: true,
        bannerUrl: true,
        faviconUrl: true,
        theme: true,
        primaryColor: true,
        secondaryColor: true,
        fontFamily: true,
        status: true,
        operatingHours: true,
        minimumOrderAmount: true,
        currency: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        deliveryFeeMode: true,
        deliveryFee: true,
        freeDeliveryAbove: true,
        allowOnlinePayment: true,
        allowPayOnDelivery: true,
        allowPayOnPickup: true,
        announcementBanner: true,
        metaTitle: true,
        metaDescription: true,
        // Delivery zones (public: name, fee, estimatedMinutes only)
        deliveryZones: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            deliveryFee: true,
            estimatedMinutes: true,
          },
          orderBy: { deliveryFee: 'asc' },
        },
      },
    });

    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);

    if (!(await hasPublicCommerceAccess(store.organizationId, store.propertyId))) {
      return errorResponse('STORE_UNAVAILABLE', 'Online ordering is temporarily unavailable.', 503);
    }

    if (store.status === 'CLOSED') {
      return errorResponse('STORE_CLOSED', 'This store is permanently closed.', 410);
    }

    if (store.status === 'SUSPENDED') {
      return errorResponse(
        'STORE_SUSPENDED',
        'Online ordering is temporarily unavailable. Please try again later or contact the restaurant directly.',
        503,
      );
    }

    if (store.status === 'DRAFT') {
      return errorResponse('STORE_NOT_PUBLISHED', 'This store is not yet open for orders.', 404);
    }

    const paymentAccount = store.propertyId ? await getPropertyPaymentAccount(store.propertyId) : null;
    return successResponse({
      ...store,
      currency: paymentAccount?.currency || store.currency,
      allowOnlinePayment: store.allowOnlinePayment && Boolean(paymentAccount),
      allowPayOnDelivery: false,
      allowPayOnPickup: false,
      paymentProvider: paymentAccount?.provider ?? null,
    });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
