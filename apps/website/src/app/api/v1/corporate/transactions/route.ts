import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

function isCredit(type: string) { return type === 'PAYMENT' || type === 'REFUND_OWED'; }

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'account:read');
  if (auth instanceof Response) return auth;
  const propertyId = new URL(req.url).searchParams.get('propertyId');
  if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId is required', 400), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'transactions'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'account:read');
    const account = await prisma.corporateAccount.findFirst({
      where: { id: principal.corporateAccountId, organizationId: auth.principal.organizationId, propertyId, isActive: true },
      select: { cityLedgerAccountId: true },
    });
    const ledger = account?.cityLedgerAccountId ? await prisma.cityLedgerAccount.findFirst({
      where: { id: account.cityLedgerAccountId, propertyId, organizationId: auth.principal.organizationId, CorporateAccount: { some: { id: principal.corporateAccountId } } },
      select: { id: true, name: true, currency: true, balance: true, status: true },
    }) : null;
    if (!ledger) return withRequestId(errorResponse('NOT_FOUND', 'Corporate wallet not found', 404), auth.requestId);
    const entries = await prisma.cityLedgerEntry.findMany({
      where: { accountId: ledger.id, propertyId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true, amount: true, currency: true, type: true, status: true, reference: true, reason: true, createdAt: true,
        guest: { select: { firstName: true, lastName: true } },
        invoice: { select: { id: true, invoiceNumber: true, description: true } },
        reservation: { select: { id: true, confirmationNumber: true, checkIn: true, checkOut: true, primaryGuest: { select: { firstName: true, lastName: true } } } },
      },
    });
    const currentBalance = Number(ledger.balance || 0);
    const totalDeltas = entries.reduce((sum, entry) => sum + (isCredit(entry.type) ? -Number(entry.amount) : Number(entry.amount)), 0);
    let runningBalance = currentBalance - totalDeltas;
    const presented = entries.map((entry) => {
      const credit = isCredit(entry.type);
      const amount = Number(entry.amount);
      runningBalance += credit ? -amount : amount;
      const guest = entry.guest || entry.reservation?.primaryGuest;
      return {
        ...entry,
        amount,
        direction: credit ? 'CREDIT' : 'DEBIT',
        runningBalance,
        guestName: guest ? `${guest.firstName} ${guest.lastName}`.trim() : null,
        context: entry.invoice?.invoiceNumber || entry.reservation?.confirmationNumber || 'Corporate wallet activity',
      };
    }).reverse();
    return withRequestId(successResponse({ wallet: { ...ledger, balance: currentBalance }, transactions: presented }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
