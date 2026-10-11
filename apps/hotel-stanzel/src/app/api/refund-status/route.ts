import { NextRequest, NextResponse } from 'next/server';
import { getRefundStatus, LodgeCoreApiError } from '@/lib/lodgecore';

export async function GET(req: NextRequest) {
  try { return NextResponse.json(await getRefundStatus(req.nextUrl.searchParams.get('query') || '')); }
  catch (error) {
    if (error instanceof LodgeCoreApiError) return NextResponse.json({ error: error.errorCode, message: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Could not load refund status' }, { status: 500 });
  }
}
