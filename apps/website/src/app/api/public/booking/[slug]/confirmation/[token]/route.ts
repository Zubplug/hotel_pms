// GET /api/public/booking/[slug]/confirmation/[token]
// Looks up a reservation by its opaque guest confirmation token.
// The token is SHA-256 hashed in the DB — the raw token is never stored.

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

export async function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token } = await params;
  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const ctx = await resolveBookingContext(slug);
  if (isErrorResponse(ctx)) return ctx;

  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const reservation = await (prisma.reservation.findFirst as any)({
    where: {
      propertyId: ctx.property.id,
      guestConfirmationTokenHash: tokenHash,
    },
    include: {
      primaryGuest: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      reservationRooms: {
        include: {
          // @ts-ignore — roomType relation exists
          roomType: { select: { name: true } },
          room: { select: { number: true } },
        },
      },
    },
  });

  if (!reservation) {
    const res = errorResponse('NOT_FOUND', 'Confirmation not found', 404);
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  const resRoom = reservation.reservationRooms[0];
  const snapshot = reservation.ratePlanSnapshot as any;

  const res = successResponse(
    {
      confirmationNumber: reservation.confirmationNumber,
      status: reservation.status,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      nights: Math.ceil(
        (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) / 86_400_000
      ),
      adults: reservation.adults,
      children: reservation.children,
      guest: reservation.primaryGuest,
      roomType: (resRoom as any)?.roomType?.name ?? null,
      roomNumber: (resRoom as any)?.room?.number ?? null,
      pricing: {
        currency: reservation.currency,
        subtotal: snapshot?.subtotal ?? null,
        depositAmount: snapshot?.depositAmount ?? 0,
        paymentMode: snapshot?.paymentMode ?? ctx.config.paymentMode,
      },
      propertyName: ctx.property.name,
    },
    200
  );

  Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
  // No CDN cache — confirmation pages are personal
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

