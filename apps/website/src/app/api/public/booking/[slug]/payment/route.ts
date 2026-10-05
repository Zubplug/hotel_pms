// POST /api/public/booking/[slug]/payment
// Initialises a Paystack payment for a PENDING reservation.
// Returns an authorization_url to redirect the guest to Paystack.

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  corsHeaders,
  corsPreflightResponse,
  resolveBookingContext,
  isErrorResponse,
  checkRateLimit,
  clientIp,
} from '@/lib/booking-engine/middleware';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import { getPaystackBookingAccount, resolveSecretRef } from '@/lib/payment-providers/booking-account';
import { resolveBookingOrigin } from '@/lib/booking-engine/request-origin';

export async function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const ctx = await resolveBookingContext(slug);
  if (isErrorResponse(ctx)) return ctx;

  if (ctx.config.paymentMode === 'PAY_LATER') {
    return errorResponse('BAD_REQUEST', 'Online payment is not required for this property', 400);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const { reservationToken, guestEmail } = body;
  if (!reservationToken || !guestEmail) {
    return errorResponse('BAD_REQUEST', 'reservationToken and guestEmail are required', 400);
  }

  const reservationTokenHash = crypto.createHash('sha256').update(String(reservationToken)).digest('hex');

  // Load the reservation
  const reservation = await prisma.reservation.findFirst({
    where: {
      propertyId: ctx.property.id,
      source: 'WEBSITE',
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
  const amountDue = ctx.config.paymentMode === 'FULL'
    ? snapshot.subtotal
    : (snapshot.depositAmount ?? snapshot.subtotal);

  if (amountDue <= 0) {
    return errorResponse('BAD_REQUEST', 'No payment amount required', 400);
  }

  // Server-generated idempotency key — prevents duplicate Paystack transactions
  // for the same reservation + amount combination
  // Check for an existing pending transaction for this reservation
  const existingTx = await prisma.bookingPaymentTransaction.findFirst({
    where: { reservationId: reservation.id, status: { in: ['PENDING', 'SUCCESS'] } },
  });
  if (existingTx?.status === 'SUCCESS') {
    return errorResponse('CONFLICT', 'Payment already completed for this reservation', 409);
  }
  if (existingTx?.status === 'PENDING') {
    return errorResponse('CONFLICT', 'A payment is already awaiting confirmation for this reservation', 409);
  }

  const idempotencyKey = `BK_PAY_${reservation.id}_${Math.round(amountDue * 100)}_${crypto.randomBytes(8).toString('hex')}`;

  // Generate a Paystack reference
  const providerRef = `BK-${reservation.id.substring(0, 8)}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

  // Create the BookingPaymentTransaction record (PENDING)
  const bpt = await prisma.bookingPaymentTransaction.create({
    data: {
      organizationId: ctx.property.organizationId,
      propertyId: ctx.property.id,
      reservationId: reservation.id,
      holdId: reservation.bookingChannelRef ?? null,
      provider: 'PAYSTACK',
      providerRef,
      amount: amountDue,
      currency: reservation.currency,
      status: 'PENDING',
      idempotencyKey,
    },
    select: { id: true },
  });

  // Initialise the Paystack transaction
  try {
    const account = await getPaystackBookingAccount(ctx.property.id);
    const secretKey = resolveSecretRef(account?.secretRef, 'PAYSTACK_SECRET_KEY');
    const paystack = new PaystackProvider(secretKey);
    const callbackUrl = `${resolveBookingOrigin(req.headers, process.env.NEXT_PUBLIC_BOOKING_URL)}/book/${slug}/confirmation?token=${encodeURIComponent(String(reservationToken))}`;

    const init = await paystack.initializeTransaction({
      amount: amountDue,
      currency: reservation.currency,
      email: guestEmail,
      reference: providerRef,
      callbackUrl,
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
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (err: any) {
    // Mark the transaction as failed and surface the error
    await prisma.bookingPaymentTransaction.update({
      where: { id: bpt.id },
      data: { status: 'FAILED', metadata: { error: err.message } as any },
    }).catch(() => null);

    console.error('[Booking Payment POST]', err);
    const res = errorResponse('BAD_GATEWAY', 'Failed to initialize payment with provider', 502);
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
}
