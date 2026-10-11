import { NextRequest, NextResponse } from 'next/server';
import { getManagedReservation, LodgeCoreApiError } from '@/lib/lodgecore';

export async function GET(req: NextRequest) {
  try { return NextResponse.json(await getManagedReservation(req.nextUrl.searchParams)); }
  catch (error) {
    if (error instanceof LodgeCoreApiError) return NextResponse.json({ error: error.errorCode, message: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Could not load reservation' }, { status: 500 });
  }
}
