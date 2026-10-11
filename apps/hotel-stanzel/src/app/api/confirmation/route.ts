import { NextRequest, NextResponse } from 'next/server';
import { getConfirmation, LodgeCoreApiError } from '@/lib/lodgecore';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) return NextResponse.json({ error: 'Confirmation token is required' }, { status: 400 });

  try {
    return NextResponse.json(await getConfirmation(token), { status: 200 });
  } catch (error) {
    if (error instanceof LodgeCoreApiError) {
      return NextResponse.json({ error: error.errorCode, message: error.message }, { status: error.statusCode });
    }
    console.error('[/api/confirmation]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Could not load booking confirmation' }, { status: 500 });
  }
}
