import { NextRequest, NextResponse } from 'next/server';
import { publicCorporateAuthRequest } from '@/lib/corporate-portal';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) return NextResponse.json({ error: 'Corporate email is required.' }, { status: 400 });
  const result = await publicCorporateAuthRequest<{ accepted: boolean; expiresAt: string }>('/api/v1/public/corporate/auth/request', { method: 'POST', body: JSON.stringify({ email }) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, message: 'If that email belongs to an active Stanzel corporate account, a secure login link has been sent.' });
}

export async function DELETE() {
  const result = NextResponse.json({ ok: true });
  result.cookies.set('stanzel_corporate_token', '', { httpOnly: true, expires: new Date(0), path: '/' });
  return result;
}
