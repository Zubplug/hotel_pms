import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForApplication, corporatePrincipalForProperty, jsonBody, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

const schema = z.object({
  propertyId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  reference: z.string().trim().max(80).optional(),
  requestedTerms: z.record(z.string(), z.unknown()),
  proposedRates: z.array(z.object({
    roomTypeId: z.string().uuid(),
    amount: z.number().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    minStay: z.number().int().min(1).optional(),
    maxStay: z.number().int().min(1).nullable().optional(),
    minRooms: z.number().int().min(1).optional(),
    maxRooms: z.number().int().min(1).nullable().optional(),
  })).min(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'rates:negotiate');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'rates:negotiate'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const parsed = schema.safeParse(await jsonBody(req, auth.principal.requestSizeLimitBytes));
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid rate negotiation request', 400, parsed.error.flatten()), auth.requestId);
    const principal = parsed.data.applicationId
      ? await corporatePrincipalForApplication(auth.principal, parsed.data.applicationId)
      : await corporatePrincipalForProperty(auth.principal, parsed.data.propertyId, 'rates:negotiate');
    const roomTypes = await prisma.roomType.findMany({ where: { propertyId: parsed.data.propertyId, isActive: true, deletedAt: null, id: { in: parsed.data.proposedRates.map(rate => rate.roomTypeId) } }, select: { id: true } });
    if (roomTypes.length !== new Set(parsed.data.proposedRates.map(rate => rate.roomTypeId)).size) return withRequestId(errorResponse('BAD_REQUEST', 'Every proposed rate must reference an active room type in this property', 400), auth.requestId);
    const request = await prisma.corporateRateNegotiationRequest.create({
      data: {
        organizationId: principal.organizationId,
        propertyId: parsed.data.propertyId,
        corporateAccountId: principal.corporateAccountId,
        corporateBookingApplicationId: principal.corporateApplicationId,
        requestedByType: 'CORPORATE',
        quoteId: parsed.data.quoteId,
        requestedById: principal.id,
        reference: parsed.data.reference,
        requestedTerms: parsed.data.requestedTerms as any,
        proposedRates: parsed.data.proposedRates,
        status: 'SUBMITTED',
      },
      select: { id: true, status: true, createdAt: true },
    });
    return withRequestId(successResponse(request, 201), auth.requestId);
  } catch (error) {
    return corporateError(error, auth.requestId);
  }
}
