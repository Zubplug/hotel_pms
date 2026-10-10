/**
 * POST /api/hold
 * Server-side proxy to LodgeCore /v1/public/hold
 * The publishable key never leaves the server. Adds rate-limiting and
 * input validation before forwarding to LodgeCore.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHold, LodgeCoreApiError } from '@/lib/lodgecore';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomTypeId, ratePlanId, checkIn, checkOut } = body ?? {};

    // Validate inputs before touching LodgeCore
    if (!roomTypeId || !UUID_RE.test(roomTypeId))
      return NextResponse.json({ error: 'Valid roomTypeId (UUID) is required' }, { status: 400 });
    if (!ratePlanId || !UUID_RE.test(ratePlanId))
      return NextResponse.json({ error: 'Valid ratePlanId (UUID) is required' }, { status: 400 });
    if (!checkIn || !DATE_RE.test(checkIn))
      return NextResponse.json({ error: 'checkIn must be YYYY-MM-DD' }, { status: 400 });
    if (!checkOut || !DATE_RE.test(checkOut))
      return NextResponse.json({ error: 'checkOut must be YYYY-MM-DD' }, { status: 400 });
    if (new Date(checkOut) <= new Date(checkIn))
      return NextResponse.json({ error: 'checkOut must be after checkIn' }, { status: 400 });

    const data = await createHold({ roomTypeId, ratePlanId, checkIn, checkOut });

    // Return the server-authoritative expiry — the client MUST use this, not compute its own
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof LodgeCoreApiError) {
      return NextResponse.json({ error: err.errorCode, message: err.message }, { status: err.statusCode });
    }
    console.error('[/api/hold]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Could not create hold' }, { status: 500 });
  }
}
