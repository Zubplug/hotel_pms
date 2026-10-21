import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { PayrollService } from '@/lib/services/payroll-service';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return NextResponse.json(
      { error: 'Payroll settlement is owned by the HR payroll workflow. Accountant is read-only control and reconciliation.' },
      { status: 409 },
    );

    const context = await requireOrganizationContext(session.user.id);
    const result = await PayrollService.payPeriod(context, (await params).id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to pay payroll';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
