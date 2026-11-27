/**
 * PATCH /api/commerce/manage/stores/[storeId]/orders/[orderId]/status
 *
 * Updates an order's operational status and fires the matching customer notification.
 * Valid transitions enforced: AWAITING_RESTAURANT → ACCEPTED → PREPARING → READY → DELIVERED/CANCELLED
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';
import { sendOrderNotification, type CommerceNotificationEvent } from '@/lib/commerce/notifications';
import { CommerceRefundService } from '@/lib/services/commerce-refund-service';
import { z } from 'zod';

type Params = { params: Promise<{ storeId: string; orderId: string }> };

const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  AWAITING_RESTAURANT: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:            ['PREPARING', 'CANCELLED'],
  PREPARING:           ['READY', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  READY:               ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  READY_FOR_PICKUP:    ['DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY:    ['DELIVERED', 'CANCELLED'],
  DELIVERED:           [],
  // A cancelled order may be submitted again by a manager while a gateway
  // refund is still pending or has failed. The refund service remains
  // idempotent and will never issue a second refund for a completed one.
  CANCELLED:           ['CANCELLED'],
};

const STATUS_TO_EVENT: Record<string, CommerceNotificationEvent> = {
  ACCEPTED:         'PREPARING',
  PREPARING:        'PREPARING',
  READY:            'READY',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED:        'DELIVERED',
  CANCELLED:        'CANCELLED',
};

const patchSchema = z.object({
  status: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
  note: z.string().max(300).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireFoodCommerceEntitlement(ctx.organizationId);
    const { storeId, orderId } = await params;

    const store = await prisma.commerceStore.findFirst({
      where: { id: storeId, organizationId: ctx.organizationId },
      select: {
        id: true,
        notifySmsEnabled: true,
        notifyEmailEnabled: true,
        termiiSenderName: true,
      },
    });
    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const order = await prisma.commerceOrder.findFirst({
      where: { id: orderId, storeId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        payment: true,
      },
    });
    if (!order) return errorResponse('NOT_FOUND', 'Order not found', 404);

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid status update', 422, parsed.error.flatten());
    }
    const { status, note } = parsed.data;

    // Enforce valid transition
    const allowed = ORDER_STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      return errorResponse(
        'INVALID_TRANSITION',
        `Cannot transition order from ${order.status} to ${status}`,
        422,
      );
    }

    let finalStatus = status;
    if (status === 'CANCELLED' && order.payment && ['VERIFIED', 'REFUND_FAILED'].includes(order.payment.status)) {
      const refundResult = await CommerceRefundService.refundOrder({
        orderId: order.id,
        actorId: session.user.id,
        reason: note || 'Commerce order cancelled by the F&B manager',
      });
      finalStatus = refundResult === 'COMPLETED' || refundResult === 'ALREADY_PROCESSED' ? 'REFUNDED' : 'CANCELLED';
    }

    const updated = await prisma.commerceOrder.update({
      where: { id: orderId },
      data: {
        status: finalStatus,
        ...(note ? { deliveryNotes: note } : {}),
        ...(finalStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
    });

    // Fire customer notification — reuses Commerce notification service
    const notificationEvent = finalStatus === 'REFUNDED' ? 'REFUNDED' : STATUS_TO_EVENT[status];
    if (notificationEvent && order.customer) {
      await sendOrderNotification({
        orderId: order.id,
        storeId,
        event: notificationEvent,
        customer: {
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email ?? undefined,
        },
        store: {
          notifySmsEnabled: store.notifySmsEnabled,
          notifyEmailEnabled: store.notifyEmailEnabled,
          termiiSenderName: store.termiiSenderName ?? null,
        },
      }).catch((e) => console.error('[commerce order notify]', e)); // non-blocking
    }

    return successResponse(updated);
  } catch (err) {
    console.error('[commerce/manage/orders/status PATCH]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
