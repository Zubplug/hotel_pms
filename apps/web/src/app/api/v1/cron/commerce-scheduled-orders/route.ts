/**
 * GET /api/v1/cron/commerce-scheduled-orders
 *
 * Promotes CommerceSyncEvents that have been queued for delivery but have not
 * been delivered to the POS terminal within the expected timeframe.
 * Also detects and flags permanently stale events.
 *
 * CommerceSyncEvent status flow:
 *   QUEUED → DELIVERED → ACKNOWLEDGED
 *                      → REJECTED
 *             → FAILED  (after too many failed attempts)
 *
 * This cron:
 *  0. Expires abandoned online checkouts whose payment window has elapsed.
 *  1. Re-queues stale DELIVERED events so a lost desktop acknowledgement can
 *     be recovered safely by the idempotent local bridge.
 *  2. Marks events FAILED after maxAttempts.
 *
 * Called every 1 minute by external CRON scheduler (Vercel Cron / Upstash).
 * Guarded by CRON_SECRET.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 10;

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return errorResponse('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  const expiredCandidates = await prisma.commerceOrder.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      paymentExpiresAt: { lte: now },
    },
    select: { id: true },
    orderBy: { paymentExpiresAt: 'asc' },
    take: 100,
  });

  let expiredOrders = 0;
  for (const candidate of expiredCandidates) {
    const expired = await prisma.$transaction(async (tx) => {
      const result = await tx.commerceOrder.updateMany({
        where: {
          id: candidate.id,
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING',
          paymentExpiresAt: { lte: now },
        },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'EXPIRED',
          posSyncStatus: 'FAILED',
        },
      });
      if (result.count !== 1) return false;
      await tx.commercePayment.updateMany({
        where: { orderId: candidate.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      return true;
    });
    if (expired) expiredOrders += 1;
  }

  const redelivered = await prisma.commerceSyncEvent.updateMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: { lte: fifteenMinutesAgo },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: {
      status: 'QUEUED',
      failureReason: 'Delivery acknowledgement timed out; queued for safe retry.',
    },
  });

  // ── Mark permanently failed events (too many attempts, still not delivered)
  const failed = await prisma.commerceSyncEvent.updateMany({
    where: {
      status: 'QUEUED',
      attempts: { gte: MAX_ATTEMPTS },
      updatedAt: { lte: fifteenMinutesAgo },
    },
    data: {
      status: 'FAILED',
      failureReason: `Exceeded ${MAX_ATTEMPTS} delivery attempts without acknowledgement`,
    },
  });

  // ── Count how many are healthy QUEUED (waiting for POS bridge to pick up) ──
  const queuedCount = await prisma.commerceSyncEvent.count({
    where: { status: 'QUEUED' },
  });

  return successResponse({
    expiredOrders,
    markedFailed: failed.count,
    requeuedDelivered: redelivered.count,
    currentlyQueued: queuedCount,
    processedAt: now.toISOString(),
  });
}
