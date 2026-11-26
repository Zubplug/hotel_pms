/**
 * GET /api/commerce/storefront/[slug]/orders/[ref]/track
 *
 * Public, unauthenticated — real-time order status for the customer.
 * Requires the trackingToken query param (issued at order creation).
 * No login needed. Shareable via link/QR code.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { hasPublicCommerceAccess } from '@/lib/commerce/public-access';

type Params = { params: Promise<{ slug: string; ref: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { slug, ref } = await params;
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return errorResponse('TOKEN_REQUIRED', 'Tracking token is required.', 400);
    }

    const store = await prisma.commerceStore.findUnique({
      where: { slug },
      select: { id: true, organizationId: true, propertyId: true },
    });
    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);
    if (!(await hasPublicCommerceAccess(store.organizationId, store.propertyId))) {
      return errorResponse('STORE_UNAVAILABLE', 'Online ordering is temporarily unavailable.', 503);
    }

    const order = await prisma.commerceOrder.findFirst({
      where: { storeId: store.id, orderRef: ref, trackingToken: token },
      select: {
        orderRef: true,
        status: true,
        orderType: true,
        fulfillmentType: true,
        scheduledFor: true,
        subtotal: true,
        deliveryFee: true,
        discountAmount: true,
        totalAmount: true,
        currency: true,
        paymentMethod: true,
        paymentStatus: true,
        specialInstructions: true,
        posSyncStatus: true,
        createdAt: true,
        updatedAt: true,
        // Public-safe item snapshot
        items: {
          select: {
            productName: true,
            productImageUrl: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            selectedModifiers: true,
            specialNote: true,
          },
        },
        // Delivery status (no driver PII)
        delivery: {
          select: {
            status: true,
            estimatedDeliveryMinutes: true,
            actualPickupAt: true,
            actualDeliveryAt: true,
          },
        },
      },
    });

    if (!order) {
      return errorResponse('NOT_FOUND', 'Order not found or tracking token is invalid.', 404);
    }

    return successResponse(order);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
