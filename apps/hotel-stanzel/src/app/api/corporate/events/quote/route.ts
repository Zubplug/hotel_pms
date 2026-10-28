import { NextRequest, NextResponse } from 'next/server';
import { corporateApiRequest } from '@/lib/corporate-portal';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const result = await corporateApiRequest('/api/v1/corporate/events/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  return NextResponse.json(result.ok ? result.data : { error: result.error }, { status: result.ok ? result.status : result.status || 502 });
}
