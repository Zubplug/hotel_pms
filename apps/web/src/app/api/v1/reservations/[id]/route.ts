import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        primaryGuest: {
          include: {
            reservations: {
              where: { id: { not: id } }, // Exclude current reservation
              orderBy: { checkIn: 'desc' },
              take: 5,
              include: {
                property: { select: { name: true } },
                reservationRooms: { include: { room: { select: { number: true } } } }
              }
            }
          }
        },
        property: { select: { id: true, name: true, city: true } },
        reservationRooms: {
          include: {
            room: {
              include: {
                doorLocks: { select: { id: true, lockCode: true, provider: true, status: true } },
                roomType: { select: { name: true, defaultBedConfig: true } },
              },
            },
          },
        },
        lockOperations: {
          orderBy: { requestedAt: 'desc' },
          take: 20,
        },
        lockCredentials: {
          where: { status: { in: ['ACTIVE', 'PENDING'] } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, credentialType: true, validFrom: true, validUntil: true, metadata: true, issuedAt: true },
        },
        folios: {
          include: {
            items: { orderBy: { createdAt: 'asc' } },
            payments: { 
              orderBy: { createdAt: 'desc' },
              include: { refunds: { orderBy: { createdAt: 'desc' } } } 
            }
          }
        },
      },
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);

    // Fetch the Audit Log explicitly because Prisma relations to a generic resourceId can be messy
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        resource: 'Reservation',
        resourceId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    await assertPropertyAccess(session.user.id, reservation.propertyId);

    return successResponse({ ...reservation, auditLogs });
  } catch (err: any) {
    if (err?.code === 'FORBIDDEN') return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', err instanceof Error ? err.message : String(err), 500, err instanceof Error ? { stack: err.stack } : undefined);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const { id } = await params;
    const body = await req.json();
    
    // First, verify property access and get the existing reservation
    const existingReservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        reservationRooms: true,
        property: { select: { organizationId: true } }
      }
    });

    if (!existingReservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    await assertPropertyAccess(session.user.id, existingReservation.propertyId);

    // Business Logic: Check-in protection
    if (['CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].includes(existingReservation.status)) {
      return errorResponse('BAD_REQUEST', `Cannot edit a ${existingReservation.status} reservation`, 400);
    }

    const {
      guestId,
      checkIn,
      checkOut,
      roomId,
      roomTypeId,
      adults,
      children,
      specialRequests
    } = body;

    // Check if dates or room changed to perform availability check
    let needsAvailabilityCheck = false;
    let newCheckInDate = existingReservation.reservationRooms[0]?.checkIn;
    let newCheckOutDate = existingReservation.reservationRooms[0]?.checkOut;
    let newRoomId = existingReservation.reservationRooms[0]?.roomId;
    let newRoomTypeId = existingReservation.reservationRooms[0]?.roomTypeId;

    if (checkIn && new Date(checkIn).getTime() !== newCheckInDate.getTime()) {
      newCheckInDate = new Date(checkIn);
      needsAvailabilityCheck = true;
    }
    if (checkOut && new Date(checkOut).getTime() !== newCheckOutDate.getTime()) {
      newCheckOutDate = new Date(checkOut);
      needsAvailabilityCheck = true;
    }
    if (roomId && roomId !== newRoomId) {
      newRoomId = roomId;
      needsAvailabilityCheck = true;
    }
    if (roomTypeId && roomTypeId !== newRoomTypeId) {
      newRoomTypeId = roomTypeId;
      needsAvailabilityCheck = true;
    }

    if (needsAvailabilityCheck && newRoomId) {
      // Re-verify availability EXCLUDING this reservation
      const overlappingRooms = await prisma.reservationRoom.findMany({
        where: {
          roomId: newRoomId,
          reservationId: { not: id },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          AND: [
            { checkIn: { lt: newCheckOutDate } },
            { checkOut: { gt: newCheckInDate } },
          ],
        }
      });
      if (overlappingRooms.length > 0) {
        return errorResponse('CONFLICT', 'The selected room is not available for these dates', 409);
      }
    }

    let newTotalAmount = (existingReservation.ratePlanSnapshot as any)?.total || 0;
    let newRateAmount = existingReservation.reservationRooms[0]?.rateAmount;

    // Recalculate pricing if room type or dates changed
    if (newRoomTypeId && newCheckInDate && newCheckOutDate && 
        (newRoomTypeId !== existingReservation.reservationRooms[0]?.roomTypeId || 
         newCheckInDate.getTime() !== existingReservation.reservationRooms[0]?.checkIn.getTime() || 
         newCheckOutDate.getTime() !== existingReservation.reservationRooms[0]?.checkOut.getTime())) {
      
      const rt = await prisma.roomType.findUnique({ where: { id: newRoomTypeId } });
      if (!rt) return errorResponse('NOT_FOUND', 'Room type not found', 404);

      newRateAmount = rt.baseRate;
      const nights = Math.max(1, Math.ceil((newCheckOutDate.getTime() - newCheckInDate.getTime()) / (1000 * 60 * 60 * 24)));
      newTotalAmount = Number(newRateAmount) * nights;
    }

    // Begin atomic transaction
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update ReservationRoom
      const updatedResRoom = await tx.reservationRoom.update({
        where: { id: existingReservation.reservationRooms[0].id },
        data: {
          roomId: newRoomId,
          roomTypeId: newRoomTypeId,
          checkIn: newCheckInDate,
          checkOut: newCheckOutDate,
          adults: adults ?? existingReservation.reservationRooms[0].adults,
          children: children ?? existingReservation.reservationRooms[0].children,
          rateAmount: newRateAmount,
        }
      });

      // 2. Update Reservation
      const updatedRes = await tx.reservation.update({
        where: { id },
        data: {
          primaryGuestId: guestId ?? existingReservation.primaryGuestId,
          ratePlanSnapshot: { ...(existingReservation.ratePlanSnapshot as object), total: newTotalAmount, baseRate: newRateAmount },
          specialRequests: specialRequests ?? existingReservation.specialRequests,
          checkIn: newCheckInDate,
          checkOut: newCheckOutDate,
          adults: adults ?? existingReservation.adults,
          children: children ?? existingReservation.children,
        }
      });

      // Determine audit events inside transaction
      const organizationId = existingReservation.property.organizationId;
      const propertyId = existingReservation.propertyId;
      
      const auditEvents: any[] = [];
      const commonAuditData = {
        organizationId,
        propertyId,
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: (session.user as any).role || 'STAFF',
        resource: 'Reservation',
        resourceId: id,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
        requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
      };

      if (newRoomId !== existingReservation.reservationRooms[0]?.roomId) {
        auditEvents.push({
          ...commonAuditData,
          action: 'ROOM_CHANGED',
          previousValue: { roomId: existingReservation.reservationRooms[0]?.roomId },
          newValue: { roomId: newRoomId },
        });
      }

      if (newCheckInDate.getTime() !== existingReservation.reservationRooms[0]?.checkIn.getTime() || 
          newCheckOutDate.getTime() !== existingReservation.reservationRooms[0]?.checkOut.getTime()) {
        auditEvents.push({
          ...commonAuditData,
          action: 'DATES_CHANGED',
          previousValue: { checkIn: existingReservation.reservationRooms[0]?.checkIn, checkOut: existingReservation.reservationRooms[0]?.checkOut },
          newValue: { checkIn: newCheckInDate, checkOut: newCheckOutDate },
        });
      }
      
      if (guestId && guestId !== existingReservation.primaryGuestId) {
        auditEvents.push({
          ...commonAuditData,
          action: 'GUEST_CHANGED',
          previousValue: { guestId: existingReservation.primaryGuestId },
          newValue: { guestId },
        });
      }

      if (newRoomTypeId !== existingReservation.reservationRooms[0]?.roomTypeId) {
        auditEvents.push({
          ...commonAuditData,
          action: 'ROOM_TYPE_CHANGED',
          previousValue: { roomTypeId: existingReservation.reservationRooms[0]?.roomTypeId },
          newValue: { roomTypeId: newRoomTypeId },
        });
      }

      const oldTotalAmount = (existingReservation.ratePlanSnapshot as any)?.total || 0;
      if (Number(newTotalAmount) !== Number(oldTotalAmount)) {
        auditEvents.push({
          ...commonAuditData,
          action: 'RATE_CHANGED',
          previousValue: { 
            rateAmount: existingReservation.reservationRooms[0]?.rateAmount,
            totalAmount: oldTotalAmount
          },
          newValue: { 
            rateAmount: newRateAmount,
            totalAmount: newTotalAmount 
          },
        });
      }

      auditEvents.push({
        ...commonAuditData,
        action: 'RESERVATION_UPDATED',
        previousValue: { status: existingReservation.status },
        newValue: { status: updatedRes.status },
      });

      await tx.auditLog.createMany({
        data: auditEvents
      });

      return { updatedRes, updatedResRoom };
    });

    return successResponse(updated.updatedRes);
  } catch (err: any) {
    console.error('[Reservation PATCH]', err);
    if (err?.code === 'P2004' || String(err).includes('P2004')) { // Exclusion constraint
      return errorResponse('CONFLICT', 'Room is already booked for these dates (Constraint Error)', 409);
    }
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
