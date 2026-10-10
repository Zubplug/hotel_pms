import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent, LodgeCoreApiError } from '@/lib/lodgecore';
import type { PaymentIntentRequest } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as PaymentIntentRequest;
    const idempotencyKey = req.headers.get('X-Idempotency-Key');
    if (!idempotencyKey || idempotencyKey.length < 16) {
      return NextResponse.json({ error: 'X-Idempotency-Key is required' }, { status: 400 });
    }
    const result = await createPaymentIntent(body, idempotencyKey);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LodgeCoreApiError) {
      return NextResponse.json({ error: error.errorCode, message: error.message, details: error.details }, { status: error.statusCode });
    }
    console.error('[/api/payment/intent]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Could not initialize payment' }, { status: 500 });
  }
}
