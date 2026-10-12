import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { verifyPayrollBankAccount } from '@/lib/services/flutterwave-payroll-service';

export async function POST(req: Request) {
  try {
    const session: any = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const ctx = await requireOrganizationContext(session.user.id);
    const body = await req.json();
    const propertyId = String(body.propertyId ?? ctx.propertyIds[0] ?? '');
    if (!ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Property is outside your authorized scope' }, { status: 403 });
    const result = await verifyPayrollBankAccount(ctx.organizationId, propertyId, String(body.accountNumber ?? ''), String(body.bankSortCode ?? ''));
    return NextResponse.json(result);
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Bank account verification failed' }, { status: 400 }); }
}
