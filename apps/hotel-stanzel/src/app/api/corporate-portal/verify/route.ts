import { NextRequest, NextResponse } from 'next/server';
import { publicCorporateAuthRequest } from '@/lib/corporate-portal';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return NextResponse.json({ error: 'Login link is required.' }, { status: 400 });
  const result = await publicCorporateAuthRequest<{ accessToken: string; expiresAt: string }>('/api/v1/public/corporate/auth/verify', { method: 'POST', body: JSON.stringify({ token }) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
  const response = NextResponse.json({ ok: true, redirectTo: '/corporate' });
  response.cookies.set('stanzel_corporate_token', result.data.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(result.data.expiresAt) });
  return response;
}
