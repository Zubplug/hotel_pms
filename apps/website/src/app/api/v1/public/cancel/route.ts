import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-response';
import { corsHeaders, corsPreflightResponse, resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { NotificationEngine } from '@/lib/notification-engine';
import { sendBookingCancellationEmail } from '@/lib/email/booking-emails';
import { calculateCancellationQuote } from '@/lib/booking-engine/cancellation-service';
import { cancelReservationTransaction } from '@/lib/booking-engine/reservation-cancellation-service';
import { CancelReservationRequestSchema } from '@hotel-pms/types';

export async function OPTIONS(req: NextRequest) { return await corsPreflightResponse(req); }

export async function POST(req: NextRequest) {
  const ip = rateLimitIdentity(req);
  if (!(await checkRateLimit(ip, 'cancel'))) return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), { status: 429, headers: corsHeaders(req) });
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  let body: any;
  try { body = await req.json(); } catch { return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400); }
  const parsedBody = CancelReservationRequestSchema.safeParse(body);
  if (!parsedBody.success) return errorResponse('BAD_REQUEST', 'Invalid cancellation payload', 400, parsedBody.error.flatten());
  const { cancelToken, confirmationNumber, guestEmail, reason } = parsedBody.data;
  const preview = body?.preview === true;
  const tokenHash = cancelToken ? crypto.createHash('sha256').update(cancelToken).digest('hex') : null;
  const reservation = await prisma.reservation.findFirst({
    where: tokenHash ? { propertyId: ctx.propertyId, guestCancellationTokenHash: tokenHash } : guestEmail ? { propertyId: ctx.propertyId, ...(confirmationNumber ? { confirmationNumber } : {}), primaryGuest: { email: { equals: guestEmail, mode: 'insensitive' as const } } } : { propertyId: ctx.propertyId, confirmationNumber },
    include: { primaryGuest: { select: { firstName: true, lastName: true, email: true } }, reservationRooms: true, cancellationPolicy: true, folios: { where: { type: 'ROOM', status: 'OPEN' }, take: 1, include: { payments: { include: { refunds: true } } } }, property: { select: { id: true, organizationId: true, businessDate: true, timezone: true, name: true } } },
  });
  if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found or cancel token is invalid', 404);
  if (!['CONFIRMED', 'PENDING'].includes(reservation.status)) return errorResponse('CONFLICT', `Reservation cannot be cancelled — current status is ${reservation.status}`, 409);
  const cancellationQuote = calculateCancellationQuote(reservation);
  if (preview) return successResponse({ confirmationNumber: reservation.confirmationNumber, currency: reservation.currency, checkIn: reservation.checkIn, checkOut: reservation.checkOut, ...cancellationQuote, canCancel: true });

  const result = await cancelReservationTransaction({ db: prisma as any, reservation, organizationId: ctx.organizationId, propertyId: ctx.propertyId, channel: 'PUBLIC_API', reason, ipAddress: ip, userAgent: req.headers.get('user-agent') ?? 'Unknown', requestId: crypto.randomUUID() });
  const refunds = result.refundRequests;
  if (reservation.primaryGuest.email) {
    const refundableAmount = refunds.reduce((sum: number, request: any) => sum + Number(request.requestedAmount || 0), 0);
    sendBookingCancellationEmail({ to: reservation.primaryGuest.email, propertyName: reservation.property.name, confirmationNumber: reservation.confirmationNumber, penaltyAmount: result.quote.penaltyAmount, currency: reservation.currency, refundAmount: refundableAmount, refundPending: refundableAmount > 0 }).catch((error) => console.error('[Booking Cancel] guest email failed', error));
  }
  NotificationEngine.emit({ type: 'RESERVATION_CANCELLED', organizationId: ctx.organizationId, propertyId: ctx.propertyId, entityType: 'reservation', entityId: reservation.id, metadata: { notificationType: 'RESERVATION_CANCELLED', reason: reason || 'Guest self-service cancellation', bookingValue: (reservation.ratePlanSnapshot as any)?.subtotal ?? 0, source: 'PUBLIC_API' } }).catch((error: any) => console.error('[Booking Cancel] Notification failed:', error));
  return successResponse({ cancelled: true, confirmationNumber: reservation.confirmationNumber, penaltyAmount: result.quote.penaltyAmount, penaltyDescription: result.quote.penaltyDescription, refundRequestsQueued: refunds.map((request: any) => ({ id: request.id, amount: Number(request.requestedAmount), currency: request.currency, status: request.status })), refundableAmount: result.quote.refundableAmount, refundNote: refunds.length > 0 ? 'A refund request has been submitted for property approval and processing.' : result.quote.penaltyAmount > 0 ? 'The cancellation charge covers the eligible payment; no refund request was created.' : 'No refundable online payment was found for this reservation.' });
}
