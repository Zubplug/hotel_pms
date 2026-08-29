import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BankDepositService } from '@/lib/services/bank-deposit-service';

export async function POST(request: NextRequest, context: { params: Promise<{ depositId: string }> }) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { depositId } = await context.params;
    const body = await request.json();
    const { bankReceiptUrl, bankReference } = body;

    const result = await BankDepositService.submitDeposit({
      depositId,
      staffId: actor.user.id,
      bankReceiptUrl,
      bankReference
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('[Submit Deposit]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}
