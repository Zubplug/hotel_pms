import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BankDepositService } from '@/lib/services/bank-deposit-service';

export async function POST(request: NextRequest) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { propertyId, posSessionIds = [], frontdeskSessionIds = [], bankName, bankAccount, notes } = body;

    if (!propertyId) return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });

    const deposit = await BankDepositService.createDeposit({
      propertyId,
      staffId: actor.user.id,
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
