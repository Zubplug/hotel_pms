import { NextRequest, NextResponse } from 'next/server';
import { createStayExtension, LodgeCoreApiError } from '@/lib/lodgecore';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { confirmationNumber, guestEmail, newCheckOut } = body ?? {};
    if (!confirmationNumber || !guestEmail || !newCheckOut) return NextResponse.json({ error: 'Reservation, email and new check-out are required' }, { status: 400 });
    const result = await createStayExtension({ confirmationNumber, guestEmail, newCheckOut, returnUrl: `${new URL(req.url).origin}/manage` }, `extend-${randomUUID()}`);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LodgeCoreApiError) return NextResponse.json({ error: error.errorCode, message: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Could not initialize extension payment' }, { status: 500 });
  }
}
