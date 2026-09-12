import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const accountId = String(body.accountId || '');
    const amount = Number(body.amount || 0);
    const description = String(body.description || '').trim();
    if (!accountId || !Number.isFinite(amount) || amount <= 0 || !description) {
      return errorResponse('BAD_REQUEST', 'Account, positive amount, and description are required', 400);
    }

    const ctx = await requireOrganizationContext(session.user.id);
    const account = await prisma.cityLedgerAccount.findUnique({ where: { id: accountId } });
    if (!account || !ctx.propertyIds.includes(account.propertyId)) return errorResponse('FORBIDDEN', 'City ledger account is not accessible', 403);
    if (account.status !== 'ACTIVE') return errorResponse('INVALID_STATE', 'City ledger account is not active', 409);

    const entry = await prisma.$transaction(async tx => {
      const created = await tx.cityLedgerEntry.create({
        data: {
          accountId,
          propertyId: account.propertyId,
          amount,
          currency: account.currency,
          type: 'TRANSFER_IN',
          status: 'OPEN',
          reason: description,
          createdBy: session.user.id,
        },
      });
      await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { increment: amount } } });
      return created;
    });

    return successResponse({ entry });
  } catch (error: any) {
    console.error('[City Ledger Invoice POST]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Unable to create city ledger debit', 500);
  }
}
