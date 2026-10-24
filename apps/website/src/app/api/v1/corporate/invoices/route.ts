import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'invoices:read');
  if (auth instanceof Response) return auth;
  const propertyId = new URL(req.url).searchParams.get('propertyId');
  if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId is required', 400), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'invoices'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'invoices:read');
    const invoices = await prisma.cityLedgerInvoice.findMany({
      where: { account: { CorporateAccount: { some: { id: principal.corporateAccountId, organizationId: auth.principal.organizationId, propertyId } } }, propertyId },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      select: { id: true, invoiceNumber: true, issueDate: true, dueDate: true, description: true, amount: true, paidAmount: true, outstandingAmount: true, currency: true, status: true },
    });
    return withRequestId(successResponse({ invoices }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
