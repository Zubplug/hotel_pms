import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BankDepositService } from '@/lib/services/bank-deposit-service';

export async function POST(request: NextRequest, context: { params: Promise<{ depositId: string }> }) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { depositId } = await context.params;

    // A POST to /verify just starts the verification process
    const result = await BankDepositService.startVerification({
      depositId,
      staffId: actor.user.id
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

    const { depositId } = await context.params;
    const body = await request.json();
    const { bankConfirmedAmount, notes } = body;

    if (bankConfirmedAmount === undefined) {
      return NextResponse.json({ error: 'bankConfirmedAmount is required' }, { status: 400 });
    }

    // A PUT to /verify finalizes the reconciliation
    const result = await BankDepositService.verifyAndReconcile({
      depositId,
      staffId: actor.user.id,
      bankConfirmedAmount: Number(bankConfirmedAmount),
      notes
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('[Reconcile Deposit]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}
