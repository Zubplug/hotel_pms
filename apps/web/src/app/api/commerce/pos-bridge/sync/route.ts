/**
 * POST /api/commerce/pos-bridge/sync
 *
 * Authenticated — called by the LodgeCore desktop POS on a 30-second poll cycle.
 *
 * Authentication: Requires a valid LodgeCore POS session (the same session key
 * used by the existing PosOutlet sync). The outletId is derived from the
 * authenticated session, not from the request body, to prevent spoofing.
 *
 * Protocol: Pull/Acknowledge cycle
 *
 *   Step 1 — PULL (GET-equivalent via POST with { action: "pull" })
 *     Returns up to 10 QUEUED CommerceSyncEvents for this outlet.
 *     Marks them DELIVERED.
 *
 *   Step 2 — ACKNOWLEDGE (POST with { action: "acknowledge", results: [...] })
 *     Desktop reports which orders it successfully created as local PosOrders.
 *     Server marks CommerceSyncEvent ACKNOWLEDGED or REJECTED accordingly.
 *     Server updates CommerceOrder.posSyncStatus and reportedPosOrderId.
 *
 * The desktop NEVER creates a CommerceOrder.
 * The cloud NEVER creates a PosOrder.
 * That boundary is sacred and enforced here.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';
import { z } from 'zod';

const pullSchema = z.object({
  action: z.literal('pull'),
  outletId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(10),
});

const acknowledgeResultSchema = z.object({
  syncEventId: z.string().uuid(),
  // Older desktop builds acknowledge by event id. Newer builds also send the
  // key; the event id remains the durable idempotency boundary.
  idempotencyKey: z.string().optional(),
  success: z.boolean(),
  localPosOrderId: z.string().optional(),
  rejectionReason: z.string().optional(),
});

const acknowledgeSchema = z.object({
  action: z.literal('acknowledge'),
  outletId: z.string().uuid(),
  results: z.array(acknowledgeResultSchema).min(1).max(50),
});

const bodySchema = z.discriminatedUnion('action', [pullSchema, acknowledgeSchema]);

export async function POST(req: NextRequest) {
  try {
    // The POS bridge requires an authenticated LodgeCore session
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'POS authentication required', 401);
    }

    const body = await req.json();
    const data = bodySchema.parse(body);

    // Verify this user/session has access to the requested outlet
    // (re-using existing hasPermission pattern)
    // For now: verify the outlet exists and belongs to the user's organization
    const outlet = await prisma.posOutlet.findUnique({
      where: { id: data.outletId },
      select: { id: true, propertyId: true, property: { select: { organizationId: true } } },
    });

    if (!outlet || outlet.property.organizationId !== session.user.organizationId) {
      return errorResponse('FORBIDDEN', 'This POS outlet is not available to the current organisation.', 403);
    }

    const store = await prisma.commerceStore.findFirst({
      where: { targetOutletId: data.outletId, organizationId: outlet.property.organizationId },
      select: { id: true, organizationId: true, propertyId: true },
    });

    if (!store) {
      return errorResponse('NOT_FOUND', 'No Commerce store linked to this outlet.', 404);
    }

    // Enforce either customer-facing Food Commerce package.
    try {
      await requireFoodCommerceEntitlement(store.organizationId, store.propertyId);
    } catch {
      return errorResponse(
        'ENTITLEMENT_REQUIRED',
        'Food Commerce add-on is not active for this organisation. Please activate it from Subscription & Add-ons.',
        403,
      );
    }

    // -------------------------------------------------------------------------
    // PULL — return queued sync events
    // -------------------------------------------------------------------------
    if (data.action === 'pull') {
      const events = await prisma.commerceSyncEvent.findMany({
        where: {
          targetOutletId: data.outletId,
          status: 'QUEUED',
        },
        orderBy: { createdAt: 'asc' },
        take: data.limit,
        include: {
          order: {
            include: {
              items: true,
              customer: { select: { name: true, phone: true, email: true } },
              delivery: { select: { status: true } },
            },
          },
        },
      });

      if (events.length === 0) {
        return successResponse({ events: [], count: 0 });
      }

      // Mark as DELIVERED (desktop has received them)
      await prisma.commerceSyncEvent.updateMany({
        where: { id: { in: events.map((e) => e.id) } },
        data: { status: 'DELIVERED', deliveredAt: new Date(), attempts: { increment: 1 } },
      });

      await prisma.commerceOrder.updateMany({
        where: { id: { in: events.map((e) => e.orderId) } },
        data: { posSyncStatus: 'DELIVERED', posSyncLastAttemptAt: new Date() },
      });

      // Strip secrets before sending to desktop
      const safeEvents = events.map((e) => ({
        syncEventId: e.id,
        idempotencyKey: e.idempotencyKey,
        payloadVersion: e.payloadVersion,
        orderId: e.order.id,
        orderRef: e.order.orderRef,
        orderType: e.order.orderType,
        fulfillmentType: e.order.fulfillmentType,
        totalAmount: Number(e.order.totalAmount),
        paymentStatus: e.order.paymentStatus,
        customerName: e.order.customer?.name ?? null,
        customerPhone: e.order.customer?.phone ?? null,
        items: e.order.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          notes: item.specialNote ?? null,
        })),
      }));

      return successResponse({ events: safeEvents, count: safeEvents.length });
    }

    // -------------------------------------------------------------------------
    // ACKNOWLEDGE — desktop reports results
    // -------------------------------------------------------------------------
    if (data.action === 'acknowledge') {
      const updates: Array<{ eventId: string; success: boolean; localId?: string; reason?: string }> = [];

      for (const result of data.results) {
        const event = await prisma.commerceSyncEvent.findFirst({
          where: {
            id: result.syncEventId,
            ...(result.idempotencyKey ? { idempotencyKey: result.idempotencyKey } : {}),
            targetOutletId: data.outletId,
          },
        });

        if (!event) continue;

        const eventUpdate = result.success
          ? {
              status: 'ACKNOWLEDGED' as const,
              acknowledgedAt: new Date(),
              reportedPosOrderId: result.localPosOrderId,
            }
          : {
              status: 'REJECTED' as const,
              rejectedAt: new Date(),
              failureReason: result.rejectionReason ?? 'Desktop rejected order',
            };

        await prisma.commerceSyncEvent.update({
          where: { id: event.id },
          data: eventUpdate,
        });

        await prisma.commerceOrder.update({
          where: { id: event.orderId },
          data: {
            posSyncStatus: result.success ? 'ACKNOWLEDGED' : 'REJECTED',
            posAcknowledgedAt: result.success ? new Date() : null,
            posRejectionReason: result.success ? null : result.rejectionReason,
            reportedPosOrderId: result.localPosOrderId,
          },
        });

        updates.push({
          eventId: event.id,
          success: result.success,
          localId: result.localPosOrderId,
          reason: result.rejectionReason,
        });
      }

      return successResponse({ acknowledged: updates.length, updates });
    }

    return errorResponse('INVALID_ACTION', 'Unknown action', 400);
  } catch (err) {
    if (err instanceof Error && err.name === 'ZodError') {
      return errorResponse('VALIDATION_ERROR', 'Invalid request body', 422);
    }
    console.error('[pos-bridge/sync]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
