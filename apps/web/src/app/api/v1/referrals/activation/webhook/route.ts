import { NextRequest, NextResponse } from 'next/server';
import prisma, { verifyFlutterwaveLegacyWebhook, verifyFlutterwaveTransaction, verifyFlutterwaveWebhook } from '@hotel-pms/db';

async function postActivationJournal(tx: any, paymentId: string, amount: number) {
  const existing = await tx.hqJournalEntryLine.findFirst({ where: { sourceType: 'REACH_ACTIVATION', sourceId: paymentId }, select: { entryId: true } });
  if (existing) return existing.entryId;
  const accounts = await tx.hqChartOfAccount.findMany({ where: { code: { in: ['1015', '4460'] }, isActive: true } });
  const byCode = new Map(accounts.map((account: any) => [account.code, account.id]));
  if (accounts.length !== 2) throw new Error('HQ Reach activation accounts are not configured');
  const entry = await tx.hqJournalEntry.create({
    data: {
      entryNumber: `HQ-JE-${Date.now()}-${paymentId.slice(0, 8)}`,
      entryDate: new Date(), description: 'LodgeCore Reach activation fee', reference: `REACH-ACTIVATION:${paymentId}`,
      source: 'REACH', status: 'POSTED', totalDebit: amount, totalCredit: amount,
      lines: { create: [
        { accountId: byCode.get('1015'), debit: amount, credit: 0, description: 'Flutterwave Reach activation clearing', sourceType: 'REACH_ACTIVATION', sourceId: paymentId },
        { accountId: byCode.get('4460'), debit: 0, credit: amount, description: 'Reach activation revenue', sourceType: 'REACH_ACTIVATION', sourceId: paymentId },
      ] },
    },
  });
  return entry.id;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyFlutterwaveWebhook(rawBody, request.headers.get('flutterwave-signature')) && !verifyFlutterwaveLegacyWebhook(request.headers.get('verif-hash'))) return new NextResponse('Forbidden', { status: 403 });
  const event = JSON.parse(rawBody) as any;
  if (!['charge.success', 'charge.completed'].includes(event.event)) return new NextResponse('OK');
  const reference = String(event.data?.tx_ref || event.data?.reference || '');
  if (!reference.startsWith('reach-activation-')) return new NextResponse('OK');
  const transactionId = event.data?.id || event.data?.transaction_id;
  if (!transactionId) return new NextResponse('OK');
  const payment = await prisma.referralActivationPayment.findUnique({ where: { providerReference: reference } });
  if (!payment || payment.status === 'PAID') return new NextResponse('OK');
  const verified = await verifyFlutterwaveTransaction(String(transactionId));
  if (verified.status !== 'successful' || Math.abs(Number(verified.amount) - Number(payment.amount)) > 0.01 || verified.currency.toUpperCase() !== payment.currency.toUpperCase()) return new NextResponse('OK');
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.referralActivationPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'PAID', providerTransactionId: String(transactionId), paidAt: new Date() } });
    if (claimed.count !== 1) return;
    const journalId = await postActivationJournal(tx, payment.id, Number(payment.amount));
    await tx.referralActivationPayment.update({ where: { id: payment.id }, data: { hqJournalEntryId: journalId } });
    const now = new Date();
    await tx.referralProgram.update({ where: { id: payment.programId }, data: { enabled: true, activatedAt: now, pausedAt: null, activationPaymentStatus: 'PAID', activationFeePaidAt: now } });
    await tx.entitlement.upsert({
      where: { scopeKey: `${payment.organizationId}:${payment.propertyId}:ADDON_REACH` },
      create: {
        organizationId: payment.organizationId,
        propertyId: payment.propertyId,
        productCode: 'ADDON_REACH',
        scopeKey: `${payment.organizationId}:${payment.propertyId}:ADDON_REACH`,
        status: 'ACTIVE',
        quantity: 1,
        startsAt: now,
        activatedAt: now,
        expiresAt: null,
        metadata: { source: 'reach_activation', activationPaymentId: payment.id },
      },
      update: {
        status: 'ACTIVE',
        quantity: 1,
        startsAt: now,
        activatedAt: now,
        expiresAt: null,
        suspendedAt: null,
        suspensionReason: null,
        metadata: { source: 'reach_activation', activationPaymentId: payment.id },
      },
    });
  });
  return new NextResponse('OK');
}
