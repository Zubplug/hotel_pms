import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { BankDepositService } from '@/lib/services/bank-deposit-service';
import { DEPOSIT_SUBMIT_ROLES, hasFinancialRole } from '@/lib/financial-control-access';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

export async function POST(request: NextRequest) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(actor.user as any).isSuperAdmin && !hasFinancialRole((actor.user as any).role, DEPOSIT_SUBMIT_ROLES)) {
      return NextResponse.json({ error: 'Only Cash Management staff can submit deposits' }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, amount, bankAccountId, bankReceiptUrl, bankReference, notes, idempotencyKey } = body;
    if (!propertyId || !bankAccountId) return NextResponse.json({ error: 'Property and bank account are required' }, { status: 400 });
    if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      return NextResponse.json({ error: 'A stable idempotencyKey is required (8-128 safe characters).' }, { status: 400 });
    }
    const ctx = await requireOrganizationContext(actor.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (await isNightAuditTransactionLocked(propertyId)) {
      return NextResponse.json({ error: 'Bank deposit cannot be submitted while Night Audit is posting. Retry after the new business date is active.', code: 'NIGHT_AUDIT_IN_PROGRESS' }, { status: 409 });
    }

    const deposit = await BankDepositService.submitAvailableCash(ctx, {
      propertyId,
      amount: String(amount),
      bankAccountId,
      idempotencyKey,
      bankReceiptUrl,
      bankReference,
      notes,
    });
    return NextResponse.json({ data: deposit });
  } catch (error: any) {
    console.error('[Submit Available Cash Deposit]', error);
    return NextResponse.json({ error: error.message || 'Unable to submit available cash' }, { status: error.status || 500 });
  }
}
