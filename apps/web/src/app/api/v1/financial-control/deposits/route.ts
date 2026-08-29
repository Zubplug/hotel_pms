import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BankDepositService } from '@/lib/services/bank-deposit-service';
import prisma from '@hotel-pms/db';
import { getUserPropertyIds } from '@/lib/property-access';
import { DEPOSIT_SUBMIT_ROLES, hasFinancialRole } from '@/lib/financial-control-access';

export async function POST(request: NextRequest) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(actor.user as any).isSuperAdmin && !hasFinancialRole((actor.user as any).role, DEPOSIT_SUBMIT_ROLES)) return NextResponse.json({ error: 'Only Cash Management staff can create deposits' }, { status: 403 });

    const body = await request.json();
    const { propertyId, posSessionIds = [], frontdeskSessionIds = [], bankName, bankAccount, notes } = body;

    if (!propertyId) return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
    if (!(await getUserPropertyIds(actor.user.id)).includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const staff = await prisma.staff.findFirst({ where: { userId: actor.user.id, isActive: true }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'Staff record not found' }, { status: 401 });

    const deposit = await BankDepositService.createDeposit({
      propertyId,
      staffId: staff.id,
      posSessionIds,
      frontdeskSessionIds,
      bankName,
      bankAccount,
      notes
    });

    return NextResponse.json({ data: deposit });
  } catch (error: any) {
    console.error('[Create Deposit]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}
