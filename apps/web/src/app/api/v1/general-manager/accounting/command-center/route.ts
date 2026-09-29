import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { AccountantAnalyticsService } from '@/lib/services/accountant-analytics-service';
import { GeneralManagerAccountingService } from '@/lib/services/general-manager-accounting-service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });

    const context = await requireOrganizationContext(session.user.id);
    if (!context.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [analytics, management] = await Promise.all([
      AccountantAnalyticsService.getOverviewKPIs(context, propertyId),
      GeneralManagerAccountingService.getCommandCenter(context, propertyId),
    ]);
    return NextResponse.json({ ...analytics, management });
  } catch (error: any) {
    console.error('[general-manager/accounting/command-center]', error);
    return NextResponse.json({ error: error.message || 'Unable to load management accounting command center' }, { status: 500 });
  }
}
