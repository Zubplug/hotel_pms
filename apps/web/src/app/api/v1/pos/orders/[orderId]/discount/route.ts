import { NextResponse } from 'next/server';

/** POS discounts are intentionally unavailable; discounts are managed in Front Desk. */
export async function POST() {
  return NextResponse.json(
    { error: 'POS discounts are disabled. Use Front Desk for room or folio discounts.' },
    { status: 410 },
  );
}
