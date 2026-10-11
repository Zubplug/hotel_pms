import { NextRequest } from 'next/server';
import crypto from 'crypto';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { corsHeaders, corsPreflightResponse, resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';

export async function OPTIONS(req: NextRequest) { return corsPreflightResponse(req); }

export async function GET(req: NextRequest) {
  if (!(await checkRateLimit(rateLimitIdentity(req), 'manage'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;

  const params = req.nextUrl.searchParams;
  const token = params.get('token')?.trim();
  const confirmationNumber = params.get('confirmationNumber')?.trim();
  const email = params.get('email')?.trim().toLowerCase();
  if (!token && !confirmationNumber && !email) return errorResponse('BAD_REQUEST', 'Provide a cancellation token, reservation number, or guest email', 400);

  // The guest dashboard is for currently active stays only. Historical
  // cancelled, checked-out, no-show, and expired reservations must not be
  // reopened through a token, email, or confirmation-number lookup.
  const activeStatuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN'] as const;
  const where = token
    ? { propertyId: ctx.propertyId, status: { in: activeStatuses }, guestCancellationTokenHash: crypto.createHash('sha256').update(token).digest('hex') }
    : email
      ? { propertyId: ctx.propertyId, status: { in: activeStatuses }, primaryGuest: { email: { equals: email, mode: 'insensitive' as const } } }
      : { propertyId: ctx.propertyId, status: { in: activeStatuses }, confirmationNumber };
  const reservation = await prisma.reservation.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      primaryGuest: { select: { firstName: true, lastName: true, email: true, phone: true } },
      property: { select: { name: true, phone: true, email: true, address: true, timezone: true } },
      reservationRooms: { where: { status: 'ACTIVE' }, include: { room: { select: { number: true, status: true, roomType: { select: { name: true } } } } } },
      folios: { where: { type: 'ROOM' }, include: { payments: { select: { amount: true, currency: true, status: true, provider: true, createdAt: true } } } },
    },
  });
  if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found. Check your details and try again.', 404);

  const snapshot = (reservation.ratePlanSnapshot as any) ?? {};
  const room = reservation.reservationRooms[0]?.room;
  const paid = reservation.folios
    .flatMap((folio: any) => folio.payments)
    .filter((payment: any) => ['COMPLETED', 'SUCCESS', 'PAID'].includes(String(payment.status).toUpperCase()))
    .reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
  // `total` is the guest-facing reservation amount, including the final
  // persisted rate-plan calculation. `subtotal` is retained only for older
  // records that predate the total snapshot field.
  const reservationTotal = Number(snapshot.total ?? snapshot.subtotal ?? 0);
  const result = {
    confirmationNumber: reservation.confirmationNumber,
    status: reservation.status,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    adults: reservation.adults,
    children: reservation.children,
    guest: reservation.primaryGuest,
    property: reservation.property,
    roomType: room?.roomType?.name ?? snapshot.roomTypeName ?? null,
    roomNumber: room?.number ?? null,
    roomStatus: room?.status ?? null,
    total: reservationTotal,
    currency: reservation.currency,
    paidAmount: paid,
    balance: Math.max(0, reservationTotal - paid),
    paymentStatus: paid >= reservationTotal ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
    canCancel: ['PENDING', 'CONFIRMED'].includes(reservation.status),
    canRequestRoomAssignment: !room && ['PENDING', 'CONFIRMED'].includes(reservation.status),
    canExtend: ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(reservation.status),
  };
  const response = successResponse(result, 200);
  Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
