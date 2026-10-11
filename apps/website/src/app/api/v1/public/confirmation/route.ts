import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { displayRoomNumber } from '@/lib/booking-engine/room-number';
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

export async function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req);
}

export async function GET(req: NextRequest) {
  const identity = rateLimitIdentity(req);
  if (!(await checkRateLimit(identity, 'confirmation'))) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;

  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token || token.length < 32) {
    return errorResponse('BAD_REQUEST', 'A valid confirmation token is required', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const reservation = await prisma.reservation.findFirst({
    where: {
      propertyId: ctx.propertyId,
      guestConfirmationTokenHash: tokenHash,
    },
    include: {
      primaryGuest: { select: { firstName: true, lastName: true, email: true, phone: true } },
      reservationRooms: {
        where: { status: 'ACTIVE' },
        include: {
          room: { select: { number: true, roomType: { select: { name: true } } } },
        },
      },
    },
  });

  if (!reservation) {
    return errorResponse('NOT_FOUND', 'Confirmation not found', 404);
  }

  const room: any = reservation.reservationRooms[0];
  const snapshot = reservation.ratePlanSnapshot as any;
  const response = successResponse({
    confirmationNumber: reservation.confirmationNumber,
    status: reservation.status,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    nights: Math.ceil((new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) / 86_400_000),
    adults: reservation.adults,
    children: reservation.children,
    guest: reservation.primaryGuest,
    roomType: room?.room?.roomType?.name ?? null,
    roomNumber: displayRoomNumber(room?.room?.number),
    pricing: {
      currency: reservation.currency,
      subtotal: snapshot?.subtotal ?? null,
      depositAmount: snapshot?.depositAmount ?? 0,
      paymentMode: snapshot?.paymentMode ?? 'PAY_LATER',
    },
    propertyName: ((await (prisma.property.findUnique as any)({ where: { id: ctx.propertyId }, select: { name: true } })) as { name?: string } | null)?.name ?? 'Your property',
  }, 200);
  Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
