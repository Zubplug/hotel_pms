import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { accountId } = await params;
    const body = await req.json();
    const amount = Number(body.amount || 0);
    const reference = String(body.reference || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !reference) return errorResponse('BAD_REQUEST', 'Positive amount and payment reference are required', 400);

    const ctx = await requireOrganizationContext(session.user.id);
    const account = await prisma.cityLedgerAccount.findUnique({ where: { id: accountId } });
    if (!account || !ctx.propertyIds.includes(account.propertyId)) return errorResponse('FORBIDDEN', 'City ledger account is not accessible', 403);
    if (account.status !== 'ACTIVE') return errorResponse('INVALID_STATE', 'City ledger account is not active', 409);

    const entry = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<Array<{ balance: number }>>`SELECT balance FROM "CityLedgerAccount" WHERE id = ${accountId}::uuid FOR UPDATE`;
      const balance = Number(locked[0]?.balance || 0);
      if (amount > balance) throw new Error('PAYMENT_EXCEEDS_BALANCE');

      const created = await tx.cityLedgerEntry.create({
        data: {
          accountId,
          propertyId: account.propertyId,
          amount,
          currency: account.currency,
          type: 'PAYMENT',
          status: 'SETTLED',
          reference,
          reason: 'Matched city ledger payment',
          createdBy: session.user.id,
        },
      });
      await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { decrement: amount } } });
      return created;
    });

    return successResponse({ entry });
  } catch (error: any) {
    if (error.message === 'PAYMENT_EXCEEDS_BALANCE') return errorResponse('PAYMENT_EXCEEDS_BALANCE', 'Payment cannot exceed the outstanding city ledger balance', 409);
    console.error('[City Ledger Payment POST]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Unable to record city ledger payment', 500);
  }
}
