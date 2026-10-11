import { NextRequest } from 'next/server';
import crypto from 'crypto';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { corsHeaders, corsPreflightResponse, resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity, originMatches } from '@/lib/booking-engine/middleware';
import { ReservationPricingService } from '@/lib/booking-engine/pricing-service';
import { getBookingPaymentAccount, resolveSecretRef } from '@/lib/payment-providers/booking-account';
import { FlutterwaveProvider } from '@/lib/payment-providers/flutterwave';
import { PaystackProvider } from '@/lib/payment-providers/paystack';

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()); }

export async function OPTIONS(req: NextRequest) { return corsPreflightResponse(req); }

export async function POST(req: NextRequest) {
  if (!(await checkRateLimit(rateLimitIdentity(req), 'extend'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  let body: any;
  try { body = await req.json(); } catch { return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400); }
  const { confirmationNumber, guestEmail, newCheckOut, returnUrl, idempotencyKey } = body ?? {};
  if (!confirmationNumber || !guestEmail || !validDate(newCheckOut) || !idempotencyKey || !returnUrl) return errorResponse('BAD_REQUEST', 'confirmationNumber, guestEmail, newCheckOut, returnUrl and idempotencyKey are required', 400);
  try {
    const parsedReturnUrl = new URL(returnUrl);
    if (parsedReturnUrl.protocol !== 'https:' || !originMatches(parsedReturnUrl.origin, ctx.allowedOrigins)) return errorResponse('BAD_REQUEST', 'returnUrl must use an allowed HTTPS origin', 400);
  } catch { return errorResponse('BAD_REQUEST', 'returnUrl must be a valid allowed URL', 400); }

  const reservation = await prisma.reservation.findFirst({
    where: { propertyId: ctx.propertyId, confirmationNumber, primaryGuest: { email: { equals: guestEmail, mode: 'insensitive' } } },
    include: { primaryGuest: { select: { email: true } }, reservationRooms: { where: { status: 'ACTIVE' }, take: 1 } },
  });
  if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
  if (!['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(reservation.status)) return errorResponse('CONFLICT', 'This reservation cannot be extended', 409);
  const currentCheckOut = new Date(reservation.checkOut);
  const requestedCheckOut = new Date(`${newCheckOut}T00:00:00Z`);
  if (requestedCheckOut <= currentCheckOut) return errorResponse('BAD_REQUEST', 'New check-out must be later than the current check-out', 400);
  const snapshot: any = reservation.ratePlanSnapshot ?? {};
  if (!snapshot.ratePlanId || !snapshot.roomTypeId) return errorResponse('CONFLICT', 'This reservation has no extendable rate plan', 409);

  const roomTypeRooms = await prisma.room.count({ where: { propertyId: ctx.propertyId, roomTypeId: snapshot.roomTypeId, isActive: true, deletedAt: null } });
  const occupied = await prisma.reservationRoom.count({ where: { roomTypeId: snapshot.roomTypeId, status: 'ACTIVE', checkIn: { lt: requestedCheckOut }, checkOut: { gt: currentCheckOut }, reservation: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } } } });
  if (occupied >= roomTypeRooms) return errorResponse('CONFLICT', 'That extension period is not available', 409);

  const quote = await ReservationPricingService.quote(prisma as any, { propertyId: ctx.propertyId, ratePlanId: snapshot.ratePlanId, roomTypeId: snapshot.roomTypeId, checkIn: currentCheckOut, checkOut: requestedCheckOut, paymentMode: 'FULL' });
  const amount = quote.subtotal;
  if (amount <= 0) return errorResponse('BAD_REQUEST', 'No payment is required for this extension', 400);
  const existing = await prisma.bookingPaymentTransaction.findUnique({ where: { idempotencyKey } });
  if (existing?.metadata && (existing.metadata as any).authorizationUrl) return successResponse({ authorizationUrl: (existing.metadata as any).authorizationUrl, amount: Number(existing.amount), currency: existing.currency, idempotent: true });
  if (existing) return errorResponse('CONFLICT', 'This extension payment is already being processed', 409);

  const account = await getBookingPaymentAccount(ctx.propertyId);
  if (!account) return errorResponse('SERVICE_UNAVAILABLE', 'No property payment account is configured', 503);
  const providerRef = `EXT-${reservation.id.slice(0, 8)}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const transaction = await prisma.bookingPaymentTransaction.create({ data: { organizationId: ctx.organizationId, propertyId: ctx.propertyId, reservationId: reservation.id, provider: account.provider, providerRef, amount, currency: quote.currency, status: 'PENDING', idempotencyKey, metadata: { type: 'EXTENSION', newCheckOut, additionalNights: quote.nights, quote: quote.snapshot, returnUrl } as any } });
  try {
    const secret = account.secret ?? resolveSecretRef(account.secretRef, account.provider === 'FLUTTERWAVE' ? 'FLW_SECRET_KEY' : 'PAYSTACK_SECRET_KEY');
    const provider = account.provider === 'FLUTTERWAVE' ? new FlutterwaveProvider(secret, account.webhookSecret ?? resolveSecretRef(account.webhookSecretRef, 'FLW_WEBHOOK_SECRET_HASH')) : new PaystackProvider(secret);
    const callbackUrl = `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}extension=processing&reference=${encodeURIComponent(providerRef)}`;
    const initialized = await provider.initializeTransaction({ amount, currency: quote.currency, email: guestEmail, reference: providerRef, callbackUrl });
    await prisma.bookingPaymentTransaction.update({ where: { id: transaction.id }, data: { metadata: { type: 'EXTENSION', newCheckOut, additionalNights: quote.nights, quote: quote.snapshot, returnUrl, authorizationUrl: initialized.authorizationUrl } as any } });
    const response = successResponse({ providerRef, authorizationUrl: initialized.authorizationUrl, amount, currency: quote.currency, newCheckOut, additionalNights: quote.nights }, 200);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error: any) {
    await prisma.bookingPaymentTransaction.update({ where: { id: transaction.id }, data: { status: 'FAILED', metadata: { error: error.message } as any } });
    return errorResponse('BAD_GATEWAY', 'Could not initialize extension payment', 502);
  }
}
