/**
 * POST /api/reservation
 * Server-side proxy to LodgeCore /v1/public/reservations
 * Requires X-Idempotency-Key from the client (generated with crypto.randomUUID()
 * when the guest enters the guest-details step and stable across retries).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createReservation, LodgeCoreApiError } from '@/lib/lodgecore';

export async function POST(req: NextRequest) {
  try {
    // The idempotency key is forwarded from the client header
    const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16) {
      return NextResponse.json(
        { error: 'X-Idempotency-Key header is required (min 16 chars)' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { holdToken, guest, adults = 1, children = 0, specialRequests } = body ?? {};

    if (!holdToken || typeof holdToken !== 'string' || holdToken.length < 1) {
      return NextResponse.json({ error: 'holdToken is required' }, { status: 400 });
    }
    if (!guest?.firstName || !guest?.lastName || !guest?.email) {
      return NextResponse.json(
        { error: 'guest.firstName, guest.lastName and guest.email are required' },
        { status: 400 }
      );
    }

    const data = await createReservation(
      { holdToken, guest, adults, children, specialRequests },
      idempotencyKey
    );

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof LodgeCoreApiError) {
      return NextResponse.json({ error: err.errorCode, message: err.message }, { status: err.statusCode });
    }
    console.error('[/api/reservation]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Could not create reservation' }, { status: 500 });
  }
}
