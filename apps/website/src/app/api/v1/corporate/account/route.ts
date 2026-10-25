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
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        baseCurrency: true,
        roomTypes: {
          where: { isActive: true, deletedAt: null },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true, baseRate: true, currency: true },
        },
      },
    });
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'account:read');
    const account = await prisma.corporateAccount.findFirst({
      where: { id: principal.corporateAccountId, organizationId: auth.principal.organizationId, propertyId, isActive: true },
      select: {
        id: true, name: true, code: true, contactPerson: true, contactEmail: true, contactPhone: true,
        creditLimit: true, depositPolicy: true, propertyId: true, ratePlanId: true,
        cityLedgerAccount: { select: { id: true, name: true, currency: true, balance: true, status: true } },
        corporateContracts: { where: { status: { in: ['APPROVED', 'ACTIVE'] } }, select: { id: true, reference: true, name: true, status: true, defaultCurrency: true, effectiveFrom: true, effectiveTo: true, negotiationEnabled: true, depositMinimumPercent: true, fallbackPolicy: true, properties: { where: { status: 'ACTIVE' }, select: { propertyId: true, effectiveFrom: true, effectiveTo: true } }, versions: { where: { status: { in: ['APPROVED', 'ACTIVE'] } }, orderBy: { version: 'desc' }, take: 1, select: { id: true, version: true, status: true, effectiveFrom: true, effectiveTo: true, termsSnapshot: true, rules: { orderBy: { priority: 'asc' }, select: { id: true, roomTypeId: true, roomType: { select: { name: true } }, rateMethod: true, amount: true, discountPercent: true, currency: true, minStay: true, maxStay: true, minRooms: true, maxRooms: true, inclusions: true, pricingFactors: true } } } } }, orderBy: { effectiveFrom: 'desc' } },
      },
    });
    if (!account) return withRequestId(errorResponse('NOT_FOUND', 'Corporate account not found', 404), auth.requestId);
    return withRequestId(successResponse({ account, defaultRates: property?.roomTypes || [], defaultRateCurrency: property?.baseCurrency || 'NGN' }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
