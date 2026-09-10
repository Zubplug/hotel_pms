import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { AccountantAnalyticsService } from '@/lib/services/accountant-analytics-service';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });
    }

    const ctx = await requireOrganizationContext(session.user.id as string);
    if (!ctx.propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const kpis = await AccountantAnalyticsService.getOverviewKPIs(ctx, propertyId);
    return NextResponse.json(kpis);
  } catch (error: any) {
    console.error('AccountantAnalytics GET Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
