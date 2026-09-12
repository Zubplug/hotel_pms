import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NotificationEngine } from '@/lib/notification-engine';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { SharedReservationService } from '@/lib/services/reservation-service';


export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const { searchParams } = req.nextUrl;
    const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1'));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
    const search   = searchParams.get('search') ?? '';
    const status   = searchParams.get('status') ?? '';
    const propertyId = searchParams.get('propertyId') ?? '';

    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
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
            where: { status: 'ACTIVE' },
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
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const body = await req.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
    const { propertyId, guestId, guestDetails, checkIn, checkOut, roomTypeId, roomId, adults, children, corporateAccountId, adjustmentType, adjustmentValue, adjustmentReason, acknowledgedByStaffId } = body;

    if (!propertyId || (!guestId && !guestDetails) || !checkIn || !checkOut || !roomTypeId || !roomId) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }
    if ((adjustmentType === 'COMP_FULL' || adjustmentType === 'COMP_PARTIAL') && !acknowledgedByStaffId) {
      return errorResponse('BAD_REQUEST', 'Acknowledging staff is required for complimentary reservations', 400);
    }
    if ((adjustmentType === 'DISCOUNT_FIXED' || adjustmentType === 'DISCOUNT_PERCENTAGE') && !acknowledgedByStaffId) {
      return errorResponse('BAD_REQUEST', 'Acknowledging staff is required for discounted reservations', 400);
    }

    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
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

    let baseRate = room.roomType.baseRate;
    const currency = room.roomType.currency || 'NGN';
    let ratePlanId = '';

    if (corporateAccountId) {
      const corporateAccount = await prisma.corporateAccount.findUnique({
        where: { id: corporateAccountId },
        include: { ratePlan: true }
      });
      if (corporateAccount?.ratePlan) {
        ratePlanId = corporateAccount.ratePlan.id;
        const rate = await prisma.rate.findFirst({
          where: { ratePlanId, roomTypeId }
        });
        if (rate && (rate as any).amount) {
          baseRate = (rate as any).amount;
        } else if (rate && (rate as any).baseAmount) {
          baseRate = (rate as any).baseAmount;
        }
      }
    }

    if (!ratePlanId) {
      const defaultRatePlan = await prisma.ratePlan.findFirst({
        where: { propertyId: { in: ctx.propertyIds as string[] } }
      });
      if (defaultRatePlan) ratePlanId = defaultRatePlan.id;
    }

    const totalAmount = Number(baseRate) * nights;

    // 2. Create the Reservation transactionally
    
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const newReservation = await SharedReservationService.createReservation({
        propertyId,
        organizationId: property.organizationId,
        guestId,
        guestDetails,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        roomTypeId,
        roomId: room.id,
        adults: parseInt(adults) || 1,
        children: parseInt(children) || 0,
        corporateAccountId,
        ratePlanId,
        currency,
        adjustmentType,
        adjustmentValue: Number(adjustmentValue),
        adjustmentReason,
        acknowledgedByStaffId,
        createdBy: (session.user as any).staffId || session.user.id,
        userEmail: session.user.email ?? undefined,
        userRole: (session.user as any).role,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
        requestId: req.headers.get('x-request-id') || crypto.randomUUID()
    });

    const reservation = { newReservation, organizationId: property.organizationId };
    

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
