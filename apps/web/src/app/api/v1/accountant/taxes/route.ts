import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { TaxRemittanceService } from '@/lib/services/tax-remittance-service';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    if (!propertyId) return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const status = searchParams.get('status') as any;
    const taxType = searchParams.get('taxType') || undefined;
    const fromDateStr = searchParams.get('fromDate');
    const toDateStr = searchParams.get('toDate');
    
    const filters = {
      ...(status && { status }),
      ...(taxType && { taxType }),
      ...(fromDateStr && { fromDate: new Date(fromDateStr) }),
      ...(toDateStr && { toDate: new Date(toDateStr) })
    };

    const result = await TaxRemittanceService.list(ctx, propertyId, filters);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { propertyId, periodStart, periodEnd, remittanceDate } = body;
    
    if (!propertyId) return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const input = {
      ...body,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      remittanceDate: new Date(remittanceDate)
    };

    const result = await TaxRemittanceService.create(ctx, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
