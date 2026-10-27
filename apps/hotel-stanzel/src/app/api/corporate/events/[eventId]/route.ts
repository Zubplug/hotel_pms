import { NextRequest, NextResponse } from 'next/server';
import { corporateApiRequest } from '@/lib/corporate-portal';
export async function GET(_request: NextRequest, context: { params: Promise<{ eventId: string }> }) { const result = await corporateApiRequest(`/api/v1/corporate/events/${encodeURIComponent((await context.params).eventId)}`, { method: 'GET' }); return NextResponse.json(result.ok ? result.data : { error: result.error }, { status: result.ok ? result.status : result.status || 502 }); }
