import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  corsHeaders,
  corsPreflightResponse,
  resolvePublicApiContext,
  isErrorResponse,
  checkRateLimit,
  rateLimitIdentity,
} from '@/lib/booking-engine/middleware';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import { FlutterwaveProvider } from '@/lib/payment-providers/flutterwave';
import { getBookingPaymentAccount, resolveSecretRef } from '@/lib/payment-providers/booking-account';
import { resolveBookingOrigin } from '@/lib/booking-engine/request-origin';
import { sendBookingPaymentFailedEmail } from '@/lib/email/booking-emails';
import { CreatePaymentIntentRequestSchema } from '@hotel-pms/types';

export async function OPTIONS(req: NextRequest) {
  return await corsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const ip = rateLimitIdentity(req);
  if (!(await checkRateLimit(ip, 'payment-intent'))) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 255) {
    return errorResponse('BAD_REQUEST', 'X-Idempotency-Key header is required', 400);
  }

  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;

  const config = await prisma.bookingEngineConfig.findUnique({
    where: { propertyId: ctx.propertyId },
    include: { property: { select: { id: true, name: true } } }
  });

  if (!config || !config.enabled) {
    return errorResponse('SERVICE_UNAVAILABLE', 'Online booking is not enabled for this property', 503);
  }

  if (config.paymentMode === 'PAY_LATER') {
    return errorResponse('BAD_REQUEST', 'Online payment is not required for this property', 400);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parsedBody = CreatePaymentIntentRequestSchema.safeParse(body);
  if (!parsedBody.success) return errorResponse('BAD_REQUEST', 'Invalid payment payload', 400, parsedBody.error.flatten());
  const { reservationToken, guestEmail } = parsedBody.data;

  const reservationTokenHash = crypto.createHash('sha256').update(String(reservationToken)).digest('hex');

  const reservation = await prisma.reservation.findFirst({
    where: {
      propertyId: ctx.propertyId,
      guestConfirmationTokenHash: reservationTokenHash,
    },
    include: {
      primaryGuest: { select: { email: true } },
      folios: {
        where: { type: 'ROOM', status: 'OPEN' },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  if (!reservation) {
    return errorResponse('NOT_FOUND', 'Reservation not found', 404);
  }
  if (!reservation.primaryGuest.email || reservation.primaryGuest.email.trim().toLowerCase() !== String(guestEmail).trim().toLowerCase()) {
    return errorResponse('NOT_FOUND', 'Reservation not found', 404);
  }
  if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
    return errorResponse('CONFLICT', 'Reservation is not in a payable state', 409);
  }

  const folio = reservation.folios[0];
  if (!folio) {
    return errorResponse('INTERNAL_ERROR', 'No open folio found for this reservation', 500);
  }

  const snapshot = reservation.ratePlanSnapshot as any;
  const amountDue = config.paymentMode === 'FULL'
    ? snapshot.subtotal
    : (snapshot.depositAmount ?? snapshot.subtotal);

  if (amountDue <= 0) {
    return errorResponse('BAD_REQUEST', 'No payment amount required', 400);
  }

  const existingByKey = await prisma.bookingPaymentTransaction.findUnique({ where: { idempotencyKey } });
  if (existingByKey) {
    if (existingByKey.reservationId !== reservation.id) return errorResponse('CONFLICT', 'Idempotency key is already in use', 409);
    if (existingByKey.status === 'SUCCESS') return errorResponse('CONFLICT', 'Payment already completed for this reservation', 409);
    const metadata = (existingByKey.metadata as any) ?? {};
    if (metadata.authorizationUrl) {
      return successResponse({ providerRef: existingByKey.providerRef, authorizationUrl: metadata.authorizationUrl, amount: Number(existingByKey.amount), currency: existingByKey.currency, idempotent: true }, 200);
    }
    return errorResponse('CONFLICT', 'A payment is already being initialized for this reservation', 409);
  }

  const existingTx = await prisma.bookingPaymentTransaction.findFirst({
    where: { reservationId: reservation.id, status: { in: ['PENDING', 'SUCCESS'] } },
  });
  if (existingTx?.status === 'SUCCESS') {
    return errorResponse('CONFLICT', 'Payment already completed for this reservation', 409);
  }
  if (existingTx?.status === 'PENDING') {
    return errorResponse('CONFLICT', 'A payment is already awaiting confirmation for this reservation', 409);
  }

  const providerRef = `BK-${reservation.id.substring(0, 8)}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

  let bpt: { id: string };
  try {
    bpt = await prisma.bookingPaymentTransaction.create({
    data: {
      organizationId: ctx.organizationId,
      propertyId: ctx.propertyId,
      reservationId: reservation.id,
      holdId: reservation.bookingChannelRef ?? null,
      provider: 'PENDING',
      providerRef,
      amount: amountDue,
      currency: reservation.currency,
      status: 'PENDING',
      idempotencyKey,
    },
    select: { id: true },
    });
  } catch {
    return errorResponse('CONFLICT', 'A payment with this idempotency key is already being initialized', 409);
  }

  try {
    const account = await getBookingPaymentAccount(ctx.propertyId);
    if (!account) throw new Error('No reservation payment account is configured');
    const secretKey = account.secret ?? resolveSecretRef(account.secretRef, account.provider === 'FLUTTERWAVE' ? 'FLW_SECRET_KEY' : 'PAYSTACK_SECRET_KEY');
    const provider = account.provider === 'FLUTTERWAVE'
      ? new FlutterwaveProvider(secretKey, account.webhookSecret ?? resolveSecretRef(account.webhookSecretRef, 'FLW_WEBHOOK_SECRET_HASH'))
      : new PaystackProvider(secretKey);
    await prisma.bookingPaymentTransaction.update({ where: { id: bpt.id }, data: { provider: account.provider } });
    const callbackUrl = `${resolveBookingOrigin(req.headers, process.env.NEXT_PUBLIC_BOOKING_URL)}/reservation?token=${encodeURIComponent(String(reservationToken))}`;

    const init = await provider.initializeTransaction({
      amount: amountDue,
      currency: reservation.currency,
      email: guestEmail,
      reference: providerRef,
      callbackUrl,
    });

    await prisma.bookingPaymentTransaction.update({
      where: { id: bpt.id },
      data: { metadata: { authorizationUrl: init.authorizationUrl } as any },
    });

    const res = successResponse(
      {
        providerRef,
        authorizationUrl: init.authorizationUrl,
        amount: amountDue,
        currency: reservation.currency,
      },
      200
    );
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (err: any) {
    await prisma.bookingPaymentTransaction.update({
      where: { id: bpt.id },
      data: { status: 'FAILED', metadata: { error: err.message } as any },
    }).catch(() => null);

    if (reservation.primaryGuest.email) {
      sendBookingPaymentFailedEmail({
        to: reservation.primaryGuest.email,
        propertyName: config.property.name,
        confirmationNumber: reservation.confirmationNumber,
        amount: amountDue,
        currency: reservation.currency,
        manageUrl: `${resolveBookingOrigin(req.headers, process.env.NEXT_PUBLIC_BOOKING_URL)}/reservation?token=${encodeURIComponent(String(reservationToken))}`,
      }).catch((emailError) => console.error('[Booking Payment] failure email failed', emailError));
    }

    console.error('[Booking Payment POST]', err);
    const res = errorResponse('BAD_GATEWAY', 'Failed to initialize payment with provider', 502);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
}
