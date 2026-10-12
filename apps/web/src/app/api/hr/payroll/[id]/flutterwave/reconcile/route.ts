import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { reconcileFlutterwavePayout } from '@/lib/services/flutterwave-payroll-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session: any = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const ctx = await requireOrganizationContext(session.user.id);
    const { id } = await params;
    const period = await prisma.payrollPeriod.findFirst({ where: { id, organizationId: ctx.organizationId, propertyId: { in: ctx.propertyIds } }, select: { id: true } });
    if (!period) return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    const payouts = await prisma.payrollPayout.findMany({ where: { payrollPeriodId: id, organizationId: ctx.organizationId, propertyId: { in: ctx.propertyIds }, status: { in: ['PROCESSING', 'UNKNOWN'] } }, select: { id: true } });
    for (const payout of payouts) await reconcileFlutterwavePayout(payout.id);
    return NextResponse.json({ reconciled: payouts.length });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Unable to reconcile payouts' }, { status: 400 }); }
}
