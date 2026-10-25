import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCorporateApi(req, 'account:read');
  if (auth instanceof Response) return auth;
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId');
  if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId is required', 400), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'transactions'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'account:read');
    const transaction = await prisma.cityLedgerEntry.findFirst({
        where: { id: (await context.params).id, propertyId, account: { CorporateAccount: { some: { id: principal.corporateAccountId, organizationId: auth.principal.organizationId, propertyId } } } },
      select: {
        id: true, amount: true, currency: true, type: true, status: true, reference: true, reason: true, createdAt: true,
        guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
        invoice: { select: { id: true, invoiceNumber: true, description: true, issueDate: true, dueDate: true, amount: true, paidAmount: true, outstandingAmount: true, status: true } },
        reservation: { select: { id: true, confirmationNumber: true, status: true, checkIn: true, checkOut: true, adults: true, children: true, primaryGuest: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        allocations: { select: { id: true, amount: true, currency: true, createdAt: true, invoice: { select: { invoiceNumber: true } } } },
      },
    });
    if (!transaction) return withRequestId(errorResponse('NOT_FOUND', 'Corporate transaction not found', 404), auth.requestId);
    const isCredit = transaction.type === 'PAYMENT' || transaction.type === 'REFUND_OWED';
    return withRequestId(successResponse({ transaction: { ...transaction, amount: Number(transaction.amount), direction: isCredit ? 'CREDIT' : 'DEBIT', allocations: transaction.allocations.map((allocation) => ({ ...allocation, amount: Number(allocation.amount) })) } }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
