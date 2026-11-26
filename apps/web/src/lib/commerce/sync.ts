/**
 * Commerce CommerceSyncEvent Enqueueing
 *
 * Creates the durable CommerceSyncEvent that carries a CommerceOrder
 * to the offline POS desktop application.
 *
 * ARCHITECTURE BOUNDARY:
 *   The cloud NEVER creates a PosOrder.
 *   This function creates CommerceSyncEvent — that's the bridge.
 *   The desktop POS is the ONLY system that creates PosOrders from Commerce.
 */

import prisma from '@hotel-pms/db';
import { Prisma } from '@hotel-pms/db';

interface EnqueueInput {
  order: {
    id: string;
    orderRef: string;
    orderType: string;
    fulfillmentType: string;
    scheduledFor?: Date | null;
    totalAmount: unknown;
    currency: string;
    paymentMethod: string;
    paymentStatus: string;
    specialInstructions?: string | null;
    deliveryAddress?: unknown;
    deliveryNotes?: string | null;
    items?: unknown[];
    customer?: { name: string; phone: string; email?: string | null } | null;
    payment?: unknown;
  };
  store: {
    id: string;
    organizationId: string;
    targetOutletId?: string | null;
    propertyId?: string | null;
  };
  idempotencyKey: string;
}

/**
 * Enqueues a CommerceSyncEvent for the desktop POS to consume on its next poll.
 *
 * Idempotent: If a sync event with the same idempotencyKey already exists,
 * it is returned without creating a duplicate.
 */
export async function enqueueCommerceSyncEvent(input: EnqueueInput) {
  const { order, store, idempotencyKey } = input;

  if (!store.targetOutletId) {
    // Store has no linked POS outlet — no sync needed
    return null;
  }

  // Check for existing sync event (idempotency)
  const existing = await prisma.commerceSyncEvent.findUnique({
    where: { idempotencyKey },
  });
  if (existing) return existing;

  // Build the versioned payload the desktop will deserialize
  const payload = {
    version: 1,
    orderRef: order.orderRef,
    orderId: order.id,
    orderType: order.orderType,
    fulfillmentType: order.fulfillmentType,
    scheduledFor: order.scheduledFor?.toISOString() ?? null,
    totalAmount: typeof order.totalAmount === 'number' ? order.totalAmount : String(order.totalAmount),
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    specialInstructions: order.specialInstructions ?? null,
    deliveryAddress: order.deliveryAddress ?? null,
    deliveryNotes: order.deliveryNotes ?? null,
    customer: order.customer
      ? {
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email ?? null,
        }
      : null,
    items: order.items ?? [],
    // Source tag so the desktop knows this is a web order
    source: 'ONLINE_WEB',
    enqueuedAt: new Date().toISOString(),
  };

  const syncEvent = await prisma.commerceSyncEvent.create({
    data: {
      storeId: store.id,
      orderId: order.id,
      targetOutletId: store.targetOutletId,
      targetPropertyId: store.propertyId ?? null,
      status: 'QUEUED',
      idempotencyKey,
      payloadVersion: 1,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  // Update order posSyncStatus
  await prisma.commerceOrder.update({
    where: { id: order.id },
    data: { posSyncStatus: 'QUEUED' },
  });

  return syncEvent;
}
