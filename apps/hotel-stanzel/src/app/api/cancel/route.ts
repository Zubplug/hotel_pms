/**
 * POST /api/cancel
 * Server-side proxy to LodgeCore /v1/public/cancel
 */
import { NextRequest, NextResponse } from 'next/server';
import { cancelReservation, LodgeCoreApiError } from '@/lib/lodgecore';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cancelToken, reason } = body ?? {};

    if (!cancelToken || typeof cancelToken !== 'string' || cancelToken.length < 32) {
      return NextResponse.json({ error: 'A valid cancelToken is required' }, { status: 400 });
    }

    // Generate a server-side idempotency key for cancellation to prevent duplicate cancellations
    // from a double-click or retry.
    const idempotencyKey = `cancel-${cancelToken.substring(0, 16)}-${randomUUID()}`;

    const data = await cancelReservation({ cancelToken, reason }, idempotencyKey);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof LodgeCoreApiError) {
      return NextResponse.json({ error: err.errorCode, message: err.message }, { status: err.statusCode });
    }
    console.error('[/api/cancel]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Could not cancel reservation' }, { status: 500 });
  }
}
