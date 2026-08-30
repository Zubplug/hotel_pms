import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';
import { NotificationEngine } from '@/lib/notification-engine';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1'));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
    const search   = searchParams.get('search') ?? '';
    const status   = searchParams.get('status') ?? '';
    const propertyId = searchParams.get('propertyId') ?? '';

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (allowedPropertyIds.length === 0) {
      return paginatedResponse([], { page, pageSize, total: 0, totalPages: 0 });
    }

    const where: Record<string, unknown> = {
      propertyId: {
        in: propertyId && allowedPropertyIds.includes(propertyId)
          ? [propertyId]
          : allowedPropertyIds,
      },
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { confirmationNumber: { contains: search, mode: 'insensitive' } },
              { primaryGuest: { firstName: { contains: search, mode: 'insensitive' } } },
              { primaryGuest: { lastName:  { contains: search, mode: 'insensitive' } } },
              { primaryGuest: { email:     { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, reservations] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { checkIn: 'asc' },
        include: {
          primaryGuest: { select: { firstName: true, lastName: true, email: true, phone: true } },
          property: { select: { name: true, city: true } },
          reservationRooms: {
            include: {
              room: { select: { number: true, status: true, roomType: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);

    return paginatedResponse(reservations, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('[Reservations GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId, guestId, guestDetails, checkIn, checkOut, roomTypeId, roomId, adults, children } = body;

    if (!propertyId || (!guestId && !guestDetails) || !checkIn || !checkOut || !roomTypeId || !roomId) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (!allowedPropertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }
    if (await isNightAuditTransactionLocked(propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Night audit cutover is in progress. New reservation financial activity resumes after the new business date is active.', 409);
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return errorResponse('BAD_REQUEST', 'Check-in and check-out must be valid dates', 400);
    }
    const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

    if (checkOutDate <= checkInDate) {
      return errorResponse('BAD_REQUEST', 'Check-out must be after check-in', 400);
    }

    // 1. Authoritative Room and RoomType Check
    const room = await prisma.room.findFirst({
      where: { id: roomId, propertyId, roomTypeId },
      include: { roomType: true },
    });

    if (!room) {
      return errorResponse('NOT_FOUND', 'Room not found or does not belong to property/room type', 404);
    }

    const baseRate = room.roomType.baseRate;
    const currency = room.roomType.currency || 'NGN';
    const totalAmount = Number(baseRate) * nights;

    // 2. Create the Reservation transactionally
    const reservation = await prisma.$transaction(async (tx: any) => {
      // Resolve Guest
      let finalGuestId = guestId;
      if (!finalGuestId) {
        const newGuest = await tx.guest.create({
          data: {
            organizationId: (await tx.property.findUnique({ where: { id: propertyId } }))?.organizationId || '',
            firstName: guestDetails.firstName,
            lastName: guestDetails.lastName,
            email: guestDetails.email,
            phone: guestDetails.phone,
          },
        });
        finalGuestId = newGuest.id;
      }

      const confirmationNumber = 'RES-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

      // Create Reservation
      const newReservation = await tx.reservation.create({
        data: {
          propertyId,
          primaryGuestId: finalGuestId as string,
          confirmationNumber,
          source: 'WALK_IN',
          status: 'CONFIRMED',
          checkIn: checkInDate,
          checkOut: checkOutDate,
          adults: parseInt(adults) || 1,
          children: parseInt(children) || 0,
          ratePlanId: (await tx.ratePlan.findFirst({ where: { propertyId } }))?.id || '',
          ratePlanSnapshot: { baseRate, total: totalAmount, currency },
          currency: currency,
          createdBy: (session.user.staffId || session.user.id) as string,
        },
      });

      // Create Reservation Guest
      await tx.reservationGuest.create({
        data: {
          reservationId: newReservation.id,
          guestId: finalGuestId,
          isPrimary: true,
        },
      });

      // Create Reservation Room with authoritative pricing and full dates
      await tx.reservationRoom.create({
        data: {
          reservationId: newReservation.id,
          roomId: room.id,
          roomTypeId: roomTypeId,
          status: 'ACTIVE',
          checkIn: checkInDate,
          checkOut: checkOutDate,
          adults: parseInt(adults) || 1,
          children: parseInt(children) || 0,
          ratePlanId: newReservation.ratePlanId,
          rateAmount: baseRate,
          currency: currency,
        },
      });

      await tx.room.update({
        where: { id: room.id },
        data: { status: 'RESERVED' },
      });

      // 7D.1: Create Folio
      const folioNumber = 'FOL-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      const newFolio = await tx.folio.create({
        data: {
          reservationId: newReservation.id,
          propertyId,
          guestId: finalGuestId,
          folioNumber,
          type: 'ROOM',
          status: 'OPEN',
          currency: currency,
          totalCharges: 0,
          totalPayments: 0,
          balance: 0,
        }
      });


      // Audit Log
      const property = await tx.property.findUnique({ where: { id: propertyId } });
      if (property) {
        await tx.auditLog.create({
          data: {
            organizationId: property.organizationId,
            propertyId: property.id,
            userId: session.user.id,
            userEmail: session.user.email,
            userRole: (session.user as any).role || 'STAFF',
            action: 'RESERVATION_CREATED',
            resource: 'Reservation',
            resourceId: newReservation.id,
            newValue: {
              confirmationNumber,
              propertyId,
              guestId: finalGuestId,
              roomId: room.id,
              roomTypeId,
              checkIn: checkInDate.toISOString(),
              checkOut: checkOutDate.toISOString(),
              adults: parseInt(adults) || 1,
              children: parseInt(children) || 0,
              status: 'CONFIRMED',
              totalAmount,
              currency
            },
            ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
            userAgent: req.headers.get('user-agent') || 'Unknown',
            requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
          },
        });
      }

      return { newReservation, organizationId: property?.organizationId || '' };
    });

    if (reservation.organizationId) {
      await NotificationEngine.emit({
        type: 'SIGNIFICANT_BOOKING',
        organizationId: reservation.organizationId,
        propertyId: propertyId,
        entityType: 'reservation',
        entityId: reservation.newReservation.id,
        idempotencyKey: `sig_booking_${reservation.newReservation.id}`,
        metadata: {
           bookingValue: totalAmount,
           isVip: false // We can check guest VIP status here later
        }
      });

      await NotificationEngine.emit({
        type: 'RESERVATION_CREATED',
        organizationId: reservation.organizationId,
        propertyId: propertyId,
        entityType: 'reservation',
        entityId: reservation.newReservation.id,
        idempotencyKey: `res_created_${reservation.newReservation.id}`,
      });
    }

    return successResponse(reservation.newReservation, 201);
  } catch (err: any) {
    console.error('[Reservations POST]', err);
    // Handle PostgreSQL exclusion constraint violation (P2004 or P2010 usually, or raw database error)
    if (err.code === 'P2010' || err.code === 'P2002' || (err.message && err.message.includes('ReservationRoom_no_overlap'))) {
      return errorResponse('CONFLICT', 'The selected room is no longer available for these dates', 409);
    }
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
