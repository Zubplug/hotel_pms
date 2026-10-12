import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { listPayrollBanks } from '@/lib/services/flutterwave-payroll-service';

export async function GET() {
  try {
    const session: any = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const ctx = await requireOrganizationContext(session.user.id);
    const propertyId = ctx.propertyIds[0];
    if (!propertyId) return NextResponse.json({ error: 'Property context is required' }, { status: 400 });
    const banks = await listPayrollBanks(ctx.organizationId, propertyId);
    return NextResponse.json({ banks: banks.map(bank => ({ code: bank.code, name: bank.name })) });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Unable to load Flutterwave banks' }, { status: 400 }); }
}
