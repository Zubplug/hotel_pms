import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'properties:read');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'properties'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    if (auth.principal.corporateAccountId) {
      const property = await prisma.property.findFirst({ where: { id: { in: [...auth.principal.propertyIds] }, organizationId: auth.principal.organizationId, isActive: true, suspendedAt: null }, select: { id: true, code: true, name: true, city: true, country: true, baseCurrency: true, timezone: true } });
      return withRequestId(successResponse({ properties: property ? [property] : [] }), auth.requestId);
    }
    const properties = await prisma.apiPartnerProperty.findMany({
      where: { partnerId: auth.principal.partnerId, property: { organizationId: auth.principal.organizationId, isActive: true, suspendedAt: null } },
      select: { property: { select: { id: true, code: true, name: true, city: true, country: true, baseCurrency: true, timezone: true } } },
      orderBy: { property: { name: 'asc' } },
    });
    return withRequestId(successResponse({ properties: properties.map((row: any) => row.property) }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
