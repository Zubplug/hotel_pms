/**
 * POST /api/availability
 * Server-side proxy to LodgeCore /v1/public/availability
 * Keeps the publishable key server-side. Returns the same shape as the upstream API.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAvailability } from '@/lib/lodgecore';
import { LodgeCoreApiError } from '@/lib/lodgecore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { checkIn, checkOut, ratePlanId, adults = 1, children = 0 } = body;

    if (!checkIn || !checkOut) {
      return NextResponse.json({ error: 'checkIn and checkOut are required' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      return NextResponse.json({ error: 'Dates must be in YYYY-MM-DD format' }, { status: 400 });
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      return NextResponse.json({ error: 'checkOut must be after checkIn' }, { status: 400 });
    }

    const data = await getAvailability({ checkIn, checkOut, ratePlanId, adults, children });
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof LodgeCoreApiError) {
      return NextResponse.json({ error: err.errorCode, message: err.message }, { status: err.statusCode });
    }
    console.error('[/api/availability]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Could not fetch availability' }, { status: 500 });
  }
}
