import { NextRequest, NextResponse } from 'next/server';
import { corporateApiRequest } from '@/lib/corporate-portal';
import { hasPublicCorporateApplication, publicCorporateApplication } from '@/lib/corporate-public';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  const query = request.nextUrl.searchParams;
  const application = await publicCorporateApplication(`/api/v1/public/corporate/bookings/${encodeURIComponent(id)}?${query.toString()}`);
  if (application.ok) return NextResponse.json(application.data, { status: application.status });
  if (await hasPublicCorporateApplication()) return NextResponse.json({ error: application.error }, { status: application.status });
  const result = await corporateApiRequest(`/api/v1/corporate/bookings/${encodeURIComponent(id)}`);
  return NextResponse.json(result.ok ? result.data : { error: result.error }, { status: result.ok ? result.status : result.status || 502 });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  const body = await request.json().catch(() => ({}));
  const application = await publicCorporateApplication(`/api/v1/public/corporate/bookings/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(body) });
  if (application.ok) return NextResponse.json(application.data, { status: application.status });
  if (await hasPublicCorporateApplication()) return NextResponse.json({ error: application.error }, { status: application.status });
  const result = await corporateApiRequest(`/api/v1/corporate/bookings/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify(body) });
  return NextResponse.json(result.ok ? result.data : { error: result.error }, { status: result.ok ? result.status : result.status || 502 });
}
