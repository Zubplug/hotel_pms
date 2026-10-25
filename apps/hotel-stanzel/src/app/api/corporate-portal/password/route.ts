import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { publicCorporateAuthRequest } from '@/lib/corporate-portal';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = (await cookies()).get('stanzel_corporate_token')?.value;
  const password = typeof body.password === 'string' ? body.password : '';
  if (!token || !password) return NextResponse.json({ error: 'A valid session and password are required.' }, { status: 400 });
  const result = await publicCorporateAuthRequest('/api/v1/public/corporate/auth/password', { method: 'POST', body: JSON.stringify({ accessToken: token, password }) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 502 });
  return NextResponse.json({ ok: true, redirectTo: '/corporate/dashboard' });
}
