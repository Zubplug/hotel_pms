import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { createCorporateQuote } from '@/lib/booking-engine/corporate-quote-service';
import { corporateError, corporatePrincipalForApplication, corporatePrincipalForProperty, jsonBody, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

const quoteSchema = z.object({ propertyId: z.string().min(1), applicationId: z.string().uuid().optional(), roomTypeId: z.string().min(1).optional(), roomSelections: z.array(z.object({ roomTypeId: z.string().min(1), roomCount: z.number().int().min(1).max(20) })).min(1).max(20).optional(), checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), adults: z.number().int().min(1).max(20), children: z.number().int().min(0).max(20), roomCount: z.number().int().min(1).max(20).default(1), paymentMode: z.string().optional(), ttlSeconds: z.number().int().optional() }).refine((value) => Boolean(value.roomSelections?.length) || Boolean(value.roomTypeId), { message: 'Select at least one room type' });

export async function POST(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'quotes:create');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'quotes:create'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const parsed = quoteSchema.safeParse(await jsonBody(req, auth.principal.requestSizeLimitBytes));
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid quote payload', 400, parsed.error.flatten()), auth.requestId);
    const body = parsed.data;
    const checkIn = new Date(`${body.checkIn}T00:00:00.000Z`); const checkOut = new Date(`${body.checkOut}T00:00:00.000Z`);
    const principal = body.applicationId
      ? await corporatePrincipalForApplication(auth.principal, body.applicationId)
      : await corporatePrincipalForProperty(auth.principal, body.propertyId, 'quotes:create');
    const quote = await createCorporateQuote(prisma as any, principal, { ...body, roomTypeId: body.roomTypeId || body.roomSelections![0].roomTypeId, checkIn, checkOut });
    return withRequestId(successResponse({ quoteId: quote.id, expiresAt: quote.expiresAt, snapshot: quote.snapshot }, 201), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'quotes:read');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'quotes:read'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const params = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(Number(params.get('limit') || 50), 1), 100);
    const propertyId = params.get('propertyId');
    const status = params.get('status');
    if (propertyId && !auth.principal.propertyIds.includes(propertyId)) return withRequestId(errorResponse('FORBIDDEN', 'Property is not enabled for this partner', 403), auth.requestId);
    const quotes = await prisma.bookingQuote.findMany({ where: { organizationId: auth.principal.organizationId, principalId: auth.principal.partnerId, propertyId: propertyId || { in: [...auth.principal.propertyIds] }, ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, propertyId: true, status: true, expiresAt: true, consumedAt: true, createdAt: true, snapshot: true } });
    return withRequestId(successResponse({ quotes, limit }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
