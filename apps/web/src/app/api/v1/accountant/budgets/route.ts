import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { BudgetService } from '@/lib/services/budget-service';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    if (!propertyId) return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const status = (searchParams.get('status') as any) || undefined;
    const yearStr = searchParams.get('year');
    const year = yearStr ? parseInt(yearStr, 10) : undefined;

    const result = await BudgetService.list(ctx, propertyId, { status, year });
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
    const propertyId = body.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const input = {
      ...body,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    };

    const result = await BudgetService.create(ctx, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
