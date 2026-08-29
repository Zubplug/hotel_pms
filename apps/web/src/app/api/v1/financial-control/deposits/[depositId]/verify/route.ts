import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BankDepositService } from '@/lib/services/bank-deposit-service';
import { DEPOSIT_VERIFY_ROLES, hasFinancialRole } from '@/lib/financial-control-access';
import prisma from '@hotel-pms/db';
import { getUserPropertyIds } from '@/lib/property-access';

export async function POST(request: NextRequest, context: { params: Promise<{ depositId: string }> }) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(actor.user as any).isSuperAdmin && !hasFinancialRole((actor.user as any).role, DEPOSIT_VERIFY_ROLES)) return NextResponse.json({ error: 'Finance Manager approval is required to verify deposits' }, { status: 403 });

    const { depositId } = await context.params;
    const deposit = await prisma.bankDeposit.findUnique({ where: { id: depositId }, select: { propertyId: true } });
    if (!deposit) return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    if (!(await getUserPropertyIds(actor.user.id)).includes(deposit.propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const staff = await prisma.staff.findFirst({ where: { userId: actor.user.id, isActive: true }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'Staff record not found' }, { status: 401 });

    // A POST to /verify just starts the verification process
    const result = await BankDepositService.startVerification({
      depositId,
      staffId: staff.id
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('[Start Deposit Verification]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ depositId: string }> }) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(actor.user as any).isSuperAdmin && !hasFinancialRole((actor.user as any).role, DEPOSIT_VERIFY_ROLES)) return NextResponse.json({ error: 'Finance Manager approval is required to reconcile deposits' }, { status: 403 });

    const { depositId } = await context.params;
    const deposit = await prisma.bankDeposit.findUnique({ where: { id: depositId }, select: { propertyId: true } });
    if (!deposit) return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    if (!(await getUserPropertyIds(actor.user.id)).includes(deposit.propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const staff = await prisma.staff.findFirst({ where: { userId: actor.user.id, isActive: true }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'Staff record not found' }, { status: 401 });
    const body = await request.json();
    const { bankConfirmedAmount, notes } = body;

    if (bankConfirmedAmount === undefined) {
      return NextResponse.json({ error: 'bankConfirmedAmount is required' }, { status: 400 });
    }

    // A PUT to /verify finalizes the reconciliation
    const result = await BankDepositService.verifyAndReconcile({
      depositId,
      staffId: staff.id,
      bankConfirmedAmount: Number(bankConfirmedAmount),
      notes
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('[Reconcile Deposit]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}
