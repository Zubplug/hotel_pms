import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { corsHeaders, corsPreflightResponse, resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';

export async function OPTIONS(req: NextRequest) { return corsPreflightResponse(req); }

export async function GET(req: NextRequest) {
  if (!(await checkRateLimit(rateLimitIdentity(req), 'manage'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  const query = req.nextUrl.searchParams.get('query')?.trim();
  if (!query) return errorResponse('BAD_REQUEST', 'Enter your reservation number or guest email', 400);
  const isEmail = query.includes('@');
  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId: ctx.propertyId,
      ...(isEmail ? { primaryGuest: { email: { equals: query.toLowerCase(), mode: 'insensitive' } } } : { confirmationNumber: query }),
      refundRequests: { some: {} },
    },
    select: {
      confirmationNumber: true, currency: true, status: true, checkIn: true, checkOut: true,
      primaryGuest: { select: { firstName: true, lastName: true, email: true } },
      refundRequests: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, requestedAmount: true, approvedAmount: true, currency: true, requestedMethod: true,
          approvedMethod: true, category: true, status: true, createdAt: true, updatedAt: true,
          payment: { select: { provider: true } },
          refund: { select: { status: true, providerRefundId: true, createdAt: true, updatedAt: true } },
          approvals: { orderBy: { decidedAt: 'asc' }, select: { decision: true, stepOrder: true, decidedAt: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' }, take: isEmail ? 10 : 1,
  });
  if (!reservations.length) return errorResponse('NOT_FOUND', 'No refund record was found for those details.', 404);
  const response = successResponse({ reservations: reservations.map((reservation) => ({
    ...reservation,
    refundRequests: reservation.refundRequests.map((refund) => ({ ...refund, requestedAmount: Number(refund.requestedAmount), approvedAmount: refund.approvedAmount == null ? null : Number(refund.approvedAmount) })),
  })) }, 200);
  Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
