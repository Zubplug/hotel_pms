import { NextRequest, NextResponse } from 'next/server';
import { hasPublicCorporateApplication, publicCorporateApplication } from '@/lib/corporate-public';
import { corporateApiRequest } from '@/lib/corporate-portal';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const application = await publicCorporateApplication('/api/v1/public/corporate/rate-negotiations', { method: 'POST', body: JSON.stringify(body) });
  if (application.ok) return NextResponse.json(application.data, { status: application.status });
  if (await hasPublicCorporateApplication()) return NextResponse.json({ error: application.error }, { status: application.status });
  const result = await corporateApiRequest('/api/v1/corporate/rate-negotiations', { method: 'POST', body: JSON.stringify(body) });
  return NextResponse.json(result.ok ? result.data : { error: result.error }, { status: result.ok ? result.status : result.status || 502 });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Negotiation request id is required.' }, { status: 400 });
  const application = await publicCorporateApplication(`/api/v1/public/corporate/rate-negotiations/${encodeURIComponent(id)}`, { method: 'GET' });
  if (application.ok) return NextResponse.json(application.data, { status: application.status });
  if (await hasPublicCorporateApplication()) return NextResponse.json({ error: application.error }, { status: application.status });
  const result = await corporateApiRequest(`/api/v1/corporate/rate-negotiations/${encodeURIComponent(id)}`);
  return NextResponse.json(result.ok ? result.data : { error: result.error }, { status: result.ok ? result.status : result.status || 502 });
}
