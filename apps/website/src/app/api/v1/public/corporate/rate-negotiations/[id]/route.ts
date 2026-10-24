import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { corsHeaders, resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { resolvePublicCorporateApplication } from '@/lib/booking-engine/corporate-public-auth';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-rate-negotiation-read'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const applicationId = req.nextUrl.searchParams.get('applicationId');
  const applicationToken = req.nextUrl.searchParams.get('applicationToken');
  if (!applicationId || !applicationToken) return errorResponse('BAD_REQUEST', 'Application credentials are required', 400);
  try {
    const application = await resolvePublicCorporateApplication(prisma as any, { applicationId, token: applicationToken, organizationId: ctx.organizationId, propertyId: ctx.propertyId });
    const request = await prisma.corporateRateNegotiationRequest.findFirst({
      where: { id: (await context.params).id, organizationId: ctx.organizationId, propertyId: ctx.propertyId, corporateBookingApplicationId: application.id },
      select: { id: true, status: true, reference: true, quoteId: true, approvedQuoteId: true, requestedTerms: true, proposedRates: true, reviewerNotes: true, resultingContractId: true, createdAt: true, updatedAt: true },
    });
    if (!request) return errorResponse('NOT_FOUND', 'Negotiation request not found', 404);
    const response = successResponse(request);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error: any) {
    return errorResponse(error?.code === 'CORPORATE_APPLICATION_UNAVAILABLE' ? 'UNAUTHORIZED' : 'NOT_FOUND', error?.message || 'Negotiation request not found', 404);
  }
}
