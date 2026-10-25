import { NextRequest, NextResponse } from 'next/server';
import { publicCorporateAuthRequest } from '@/lib/corporate-portal';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email) return NextResponse.json({ error: 'Corporate email is required.' }, { status: 400 });
  if (body.magicLink === true) {
    const result = await publicCorporateAuthRequest<{ accepted: boolean; expiresAt: string }>('/api/v1/public/corporate/auth/request', { method: 'POST', body: JSON.stringify({ email }) });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 502 });
    return NextResponse.json({ ok: true, message: 'If the account is eligible, a secure recovery link has been sent.' });
  }
  if (!password) return NextResponse.json({ error: 'Corporate password is required.' }, { status: 400 });
  const result = await publicCorporateAuthRequest<{ accessToken: string; expiresAt: string }>('/api/v1/public/corporate/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 502 });
  const response = NextResponse.json({ ok: true, redirectTo: '/corporate/dashboard' });
  response.cookies.set('stanzel_corporate_token', result.data.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(result.data.expiresAt) });
  return response;
}

export async function DELETE() {
  const result = NextResponse.json({ ok: true });
  result.cookies.set('stanzel_corporate_token', '', { httpOnly: true, expires: new Date(0), path: '/' });
  return result;
}
