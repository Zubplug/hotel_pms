import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { postReachPayout } from '@/lib/reach-accounting';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const userId = String(session.user.id);
    const ctx = await requireOrganizationContext(userId);
    const role = String((session.user as any).role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'].includes(role)) return errorResponse('FORBIDDEN', 'Finance authorization required', 403);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const settlementAccountId = String(body.settlementAccountId || '');
    if (!settlementAccountId) return errorResponse('BAD_REQUEST', 'settlementAccountId is required', 400);

    const result = await prisma.$transaction(async (tx: any) => {
      const payout = await tx.referralPayout.findUnique({
        where: { id },
        include: { commissions: { include: { commission: true } } },
      });
      if (!payout) throw new Error('NOT_FOUND');
      if (payout.organizationId !== ctx.organizationId || !ctx.propertyIds.includes(payout.propertyId)) throw new Error('FORBIDDEN');
      if (!['PENDING', 'PROCESSING'].includes(payout.status)) throw new Error('CONFLICT');

      const account = await tx.chartOfAccount.findFirst({ where: { id: settlementAccountId, propertyId: payout.propertyId, isActive: true } });
      if (!account || account.type !== 'ASSET') throw new Error('INVALID_SETTLEMENT_ACCOUNT');

      const amount = Number(payout.amount);
      const journal = await postReachPayout({
        tx,
        payoutId: payout.id,
        propertyId: payout.propertyId,
        organizationId: payout.organizationId,
        actorId: userId,
        settlementAccountId: account.id,
        amount,
        entryDate: new Date(),
      });
      const ledgerKey = `REACH_PAYOUT:${payout.id}`;
      await tx.referralLedgerEntry.create({
        data: {
          organizationId: payout.organizationId,
          partnerId: payout.partnerId,
          payoutId: payout.id,
          entryType: 'PAYOUT',
          amount: -amount,
          currency: payout.currency,
          idempotencyKey: ledgerKey,
          journalEntryId: journal.id,
          metadata: { settlementAccountId: account.id, settlementMethod: body.settlementMethod || 'MANUAL' },
        },
      });
      for (const item of payout.commissions) {
        await tx.referralCommission.update({ where: { id: item.commissionId }, data: { status: 'PAID', paidAt: new Date() } });
      }
      return tx.referralPayout.update({
        where: { id: payout.id },
        data: {
          status: 'PAID',
          processedAt: new Date(),
          payoutReference: body.reference ? String(body.reference) : payout.payoutReference,
          settlementMethod: body.settlementMethod ? String(body.settlementMethod) : 'MANUAL',
          settlementAccountId: account.id,
          journalEntryId: journal.id,
        },
      });
    });
    return successResponse(result);
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Payout not found', 404);
    if (error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Access denied', 403);
    if (error.message === 'CONFLICT') return errorResponse('CONFLICT', 'Payout is no longer payable', 409);
    if (error.message === 'INVALID_SETTLEMENT_ACCOUNT') return errorResponse('BAD_REQUEST', 'Settlement account must be an active asset account for the payout property', 400);
    console.error('[Reach payout settlement]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to settle Reach payout', 500);
  }
}
