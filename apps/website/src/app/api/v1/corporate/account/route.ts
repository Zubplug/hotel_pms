import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'account:read');
  if (auth instanceof Response) return auth;
  const propertyId = new URL(req.url).searchParams.get('propertyId');
  if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId is required', 400), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'account'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'account:read');
    const account = await prisma.corporateAccount.findFirst({
      where: { id: principal.corporateAccountId, organizationId: auth.principal.organizationId, propertyId, isActive: true },
      select: {
        id: true, name: true, code: true, contactPerson: true, contactEmail: true, contactPhone: true,
        creditLimit: true, depositPolicy: true, propertyId: true, ratePlanId: true,
        cityLedgerAccount: { select: { id: true, name: true, currency: true, balance: true, status: true } },
        corporateContracts: { where: { status: { in: ['APPROVED', 'ACTIVE'] } }, select: { id: true, reference: true, name: true, status: true, defaultCurrency: true, paymentMode: true, effectiveFrom: true, effectiveTo: true }, orderBy: { effectiveFrom: 'desc' } },
      },
    });
    if (!account) return withRequestId(errorResponse('NOT_FOUND', 'Corporate account not found', 404), auth.requestId);
    return withRequestId(successResponse({ account }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
