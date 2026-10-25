import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, jsonBody, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

const schema = z.object({
  propertyId: z.string().uuid(),
  companyName: z.string().trim().min(2).max(160),
  contactPerson: z.string().trim().min(2).max(120),
  contactEmail: z.string().email().max(320),
  contactPhone: z.string().trim().max(50).optional(),
  companyAddress: z.string().trim().min(5).max(240).optional(),
  companyCity: z.string().trim().min(2).max(100).optional(),
  companyCountry: z.string().trim().min(2).max(100).optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  paymentMode: z.enum(['FULL', 'DEPOSIT', 'PAY_LATER']).default('PAY_LATER'),
});

/** Creates only a short-lived application. It never creates a PMS account. */
export async function POST(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'quotes:create');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'corporate-application'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const parsed = schema.safeParse(await jsonBody(req, auth.principal.requestSizeLimitBytes));
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid corporate application', 400, parsed.error.flatten()), auth.requestId);
    const body = parsed.data;
    if (!auth.principal.propertyIds.includes(body.propertyId)) return withRequestId(errorResponse('FORBIDDEN', 'Property is not enabled for this partner', 403), auth.requestId);
    const property = await prisma.property.findFirst({ where: { id: body.propertyId, organizationId: auth.principal.organizationId, isActive: true, suspendedAt: null }, select: { baseCurrency: true, supportedCurrencies: true } });
    if (!property) return withRequestId(errorResponse('NOT_FOUND', 'Property not found', 404), auth.requestId);
    const currency = (body.currency || property.baseCurrency).toUpperCase();
    if (![property.baseCurrency, ...(property.supportedCurrencies || [])].map(value => value.toUpperCase()).includes(currency)) return withRequestId(errorResponse('BAD_REQUEST', 'Currency is not supported by this property', 400), auth.requestId);
    const existingAccount = await prisma.corporateAccount.findFirst({ where: { organizationId: auth.principal.organizationId, propertyId: body.propertyId, isActive: true, contactEmail: { equals: body.contactEmail.toLowerCase(), mode: 'insensitive' } }, select: { id: true, name: true } });
    if (existingAccount) return withRequestId(errorResponse('ACCOUNT_EXISTS', 'A corporate account already exists for this contact at this property. Reuse the existing corporate account for the reservation.', 409, { corporateAccountId: existingAccount.id, accountName: existingAccount.name }), auth.requestId);
    const application = await prisma.corporateBookingApplication.create({ data: { organizationId: auth.principal.organizationId, propertyId: body.propertyId, companyName: body.companyName, contactPerson: body.contactPerson, contactEmail: body.contactEmail.toLowerCase(), contactPhone: body.contactPhone || null, companyAddress: body.companyAddress || null, companyCity: body.companyCity || null, companyCountry: body.companyCountry || null, paymentMode: body.paymentMode, requestedCurrency: currency, sourceChannel: 'CORPORATE_API', principalId: auth.principal.partnerId, status: 'PENDING', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }, select: { id: true, status: true, expiresAt: true } });
    return withRequestId(successResponse({ applicationId: application.id, status: application.status, expiresAt: application.expiresAt }, 201), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
