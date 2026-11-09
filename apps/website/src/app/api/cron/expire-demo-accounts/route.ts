import { NextRequest, NextResponse } from 'next/server';
import { expireDemoAccounts } from '@/lib/demo-accounts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || supplied !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await expireDemoAccounts();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
