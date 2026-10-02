// POST /api/v1/cron/expire-booking-holds
// Expires ACTIVE BookingHold records whose TTL has elapsed.
// Called by Vercel Cron (every 2 minutes) or QStash.
// Secured by deployment-level access control — no public exposure.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const now = new Date();

    // Batch-expire all ACTIVE holds whose TTL has passed.
    // We use updateMany for efficiency — no need to process each hold individually
    // since hold expiry is a state transition only (no folio/accounting side effects).
    const result = await prisma.bookingHold.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return NextResponse.json({
      success: true,
      expired: result.count,
      runAt: now.toISOString(),
    });
  } catch (err: any) {
    console.error('[Cron: expire-booking-holds]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

