import { NextRequest, NextResponse } from 'next/server';
import { publicCorporateApiRequest } from '@/lib/corporate-portal';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await publicCorporateApiRequest<{ applicationId: string; applicationToken: string; expiresAt: string }>('/api/v1/public/corporate/applications', { method: 'POST', body: JSON.stringify(body) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  const response = NextResponse.json({ ok: true, redirectTo: '/corporate/book?mode=application' });
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', expires: new Date(result.data.expiresAt) };
  response.cookies.set('stanzel_corporate_application_id', result.data.applicationId, options);
  response.cookies.set('stanzel_corporate_application_token', result.data.applicationToken, options);
  return response;
}
