import { NextRequest, NextResponse } from 'next/server';
import { corporateApiRequest } from '@/lib/corporate-portal';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const result = await corporateApiRequest(`/api/v1/corporate/events/availability?${query}`);
  return NextResponse.json(result.ok ? result.data : { error: result.error }, { status: result.ok ? result.status : result.status || 502 });
}
