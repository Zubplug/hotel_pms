import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { PayrollService } from '@/lib/services/payroll-service';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    if (!propertyId) return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result = await PayrollService.listStructures(ctx, propertyId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { propertyId, staffId, ...rest } = body;
    if (!propertyId || !staffId) return NextResponse.json({ error: 'Missing propertyId or staffId' }, { status: 400 });

    if (rest.effectiveFrom) {
      rest.effectiveFrom = new Date(rest.effectiveFrom);
    } else {
      rest.effectiveFrom = new Date(); // fallback
    }

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result = await PayrollService.updateStructure(ctx, staffId, { propertyId, ...rest });
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
