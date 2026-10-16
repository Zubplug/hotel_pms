import { NextRequest, NextResponse } from 'next/server';
import { verifyFlutterwaveTransaction, verifyFlutterwaveWebhook, verifyFlutterwaveLegacyWebhook, settleReachWallet, refreshReachPropertyDebt } from '@hotel-pms/db';
import prisma from '@hotel-pms/db';

async function hqJournal(tx: any, input: { type: string; sourceId: string; amount: number; actorId?: string }) {
  const existing = await tx.hqJournalEntryLine.findFirst({ where: { sourceType: input.type, sourceId: input.sourceId }, select: { entryId: true } });
  if (existing) return existing.entryId;
  const codes = input.type === 'REACH_WALLET_FUNDING' ? ['1015', '2305'] : ['2305', '1205'];
  const accounts = await tx.hqChartOfAccount.findMany({ where: { code: { in: codes }, isActive: true } });
  const byCode = new Map(accounts.map((a: any) => [a.code, a.id]));
  if (accounts.length !== 2) throw new Error('HQ Reach wallet accounts are not configured');
  const funding = input.type === 'REACH_WALLET_FUNDING';
  const debit = funding ? byCode.get('1015') : byCode.get('2305');
  const credit = funding ? byCode.get('2305') : byCode.get('1205');
  const entry = await tx.hqJournalEntry.create({ data: { entryNumber: `HQ-JE-${Date.now()}-${input.sourceId.slice(0, 8)}`, entryDate: new Date(), description: funding ? 'Flutterwave Reach wallet funding' : 'Reach platform fee paid from wallet', reference: input.sourceId, source: 'REACH', status: 'POSTED', totalDebit: input.amount, totalCredit: input.amount, createdBy: input.actorId || null, lines: { create: [{ accountId: debit, debit: input.amount, credit: 0, sourceType: input.type, sourceId: input.sourceId }, { accountId: credit, debit: 0, credit: input.amount, sourceType: input.type, sourceId: input.sourceId }] } } });
  return entry.id;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get('flutterwave-signature');
  const legacy = request.headers.get('verif-hash');
  if (!verifyFlutterwaveWebhook(raw, signature) && !verifyFlutterwaveLegacyWebhook(legacy)) return new NextResponse('Forbidden', { status: 403 });
  const event = JSON.parse(raw) as any;
  if (!['charge.success', 'charge.completed'].includes(event.event)) return new NextResponse('OK');
  const reference = String(event.data?.tx_ref || event.data?.reference || '');
  if (!reference.startsWith('reach-wallet-')) return new NextResponse('OK');
  const transactionId = event.data?.id || event.data?.transaction_id;
  if (!transactionId) return new NextResponse('OK');
  const pending = await prisma.reachWalletTransaction.findFirst({ where: { providerReference: reference, type: 'FUNDING' } });
  if (!pending || pending.status === 'COMPLETED') return new NextResponse('OK');
  const verified = await verifyFlutterwaveTransaction(String(transactionId));
  if (verified.status !== 'successful' || Math.abs(Number(verified.amount) - Number(pending.amount)) > 0.01 || verified.currency.toUpperCase() !== pending.currency.toUpperCase()) return new NextResponse('OK');
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.reachWalletTransaction.updateMany({ where: { id: pending.id, status: 'PENDING' }, data: { status: 'COMPLETED', completedAt: new Date(), providerReference: reference } });
    if (claimed.count !== 1) return;
    const wallet = await tx.reachWallet.update({ where: { id: pending.walletId }, data: { balance: { increment: pending.amount } } });
    const fundingJournal = await hqJournal(tx, { type: 'REACH_WALLET_FUNDING', sourceId: pending.id, amount: Number(pending.amount) });
    await tx.reachWalletTransaction.update({ where: { id: pending.id }, data: { balanceAfter: wallet.balance, hqJournalEntryId: fundingJournal } });
    const allocations = await settleReachWallet(tx, { organizationId: pending.organizationId, now: new Date() });
    for (const allocation of allocations) {
      const journalId = await hqJournal(tx, { type: 'REACH_WALLET_SETTLEMENT', sourceId: allocation.walletTransactionId, amount: allocation.amount });
      await tx.reachWalletTransaction.update({ where: { id: allocation.walletTransactionId }, data: { hqJournalEntryId: journalId } });
    }
    await refreshReachPropertyDebt(tx, pending.organizationId, Array.from(new Set(allocations.map((item) => item.propertyId))), new Date());
  });
  return new NextResponse('OK');
}
