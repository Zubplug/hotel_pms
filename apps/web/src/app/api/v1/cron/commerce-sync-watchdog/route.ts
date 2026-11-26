/**
 * GET /api/v1/cron/commerce-sync-watchdog
 *
 * Detects online orders where payment is PAID but no CommerceSyncEvent
 * exists (sync missed during order placement) and re-enqueues them.
 *
 * Also finds DELIVERED events that have not been ACKNOWLEDGED after 10 min —
 * suggesting the terminal injected the order but failed to call back — and
 * sends the customer a reassurance notification.
 *
 * Called every 5 minutes by external CRON scheduler.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { sendCommerceNotification } from '@/lib/commerce/notifications';
import { generateOrderIdempotencyKey } from '@/lib/commerce/order-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return errorResponse('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const now = new Date();
  const tenMinutesAgo     = new Date(now.getTime() - 10 * 60 * 1000);
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  // ── 1. Orphaned orders: AWAITING_RESTAURANT + PAID + no sync event ────────
  const orphanOrders = await prisma.commerceOrder.findMany({
    where: {
      status: 'AWAITING_RESTAURANT',
      paymentStatus: 'PAID',
      createdAt: { lte: fifteenMinutesAgo },
      syncEvents: { none: {} },
    },
    include: {
      store: { select: { id: true, propertyId: true, targetOutletId: true } },
      customer: { select: { name: true, phone: true, email: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    take: 20,
  });

  let reEnqueued = 0;
  for (const order of orphanOrders) {
    try {
      const idempotencyKey = generateOrderIdempotencyKey(order.id, 'watchdog-reenqueue');
      if (!order.store.targetOutletId) continue;

      await prisma.commerceSyncEvent.create({
        data: {
          storeId:         order.storeId,
          orderId:         order.id,
          targetOutletId:  order.store.targetOutletId,
          targetPropertyId: order.store.propertyId ?? undefined,
          status:          'QUEUED',
          idempotencyKey,
          payloadVersion:  1,
          payload:         {
            orderRef:    order.orderRef,
            source:      'watchdog-reenqueue',
            customer: order.customer,
            orderType:   order.orderType,
            items:       order.items.map(i => ({
              productId:   i.productId,
              productName: i.product?.name ?? i.productName,
              quantity:    i.quantity,
              unitPrice:   i.unitPrice,
            })),
          },
          attempts: 0,
        },
      });
      reEnqueued++;
    } catch (err: any) {
      // P2002 = unique constraint — idempotency key already exists, skip
      if (err?.code !== 'P2002') {
        console.error('[commerce-sync-watchdog] Re-enqueue failed for order', order.id, err);
      }
    }
  }

  // ── 2. Delivered but not acknowledged after 10 min → reassure customer ────
  const unacknowledged = await prisma.commerceSyncEvent.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: { lte: tenMinutesAgo },
    },
    include: {
      order: { include: { customer: true, store: true } },
    },
    take: 30,
  });

  let notified = 0;
  for (const event of unacknowledged) {
    const alreadyNotified = await prisma.commerceNotificationLog.findFirst({
      where: {
        orderId: event.orderId,
        event: 'SYNC_DELAYED',
        createdAt: { gte: fifteenMinutesAgo },
      },
      select: { id: true },
    });
    if (alreadyNotified) continue;

    if (event.order?.customer) {
      try {
        await sendCommerceNotification({
          type: 'ORDER_DELAYED',
          order: event.order as any,
          customer: event.order.customer as any,
          store: event.order.store as any,
        });
        notified++;
      } catch (notifyErr) {
        console.error('[commerce-sync-watchdog] Notification failed:', notifyErr);
      }
    }
  }

  return successResponse({
    reEnqueuedOrphans:          reEnqueued,
    unacknowledgedAfter10min:   unacknowledged.length,
    customerNotificationsSent:  notified,
    processedAt:                now.toISOString(),
  });
}
