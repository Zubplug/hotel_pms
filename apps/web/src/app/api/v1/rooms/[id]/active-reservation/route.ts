import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    const room = await prisma.room.findUnique({
      where: { id },
      select: { propertyId: true, status: true, number: true }
    });

    if (!room) return errorResponse('NOT_FOUND', 'Room not found', 404);

    // Enforce property/organization authorization server-side
    await assertPropertyAccess(session.user.id, room.propertyId);

    // Find the ACTIVE reservation room assignment for this room
    // where the parent reservation is currently CHECKED_IN
    const activeAssignment = await prisma.reservationRoom.findFirst({
      where: {
        roomId: id,
        status: 'ACTIVE',
        reservation: {
          status: 'CHECKED_IN',
        }
      },
      include: {
        reservation: {
          include: {
            primaryGuest: true,
            folios: {
              where: { status: 'OPEN', type: 'ROOM' }
            },
            lockCredentials: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    });

    if (!activeAssignment) {
      return errorResponse('NOT_FOUND', 'No active occupancy record found for this room', 404);
    }

    const reservation = activeAssignment.reservation;

    // Calculate folio balance if any
    const folio = reservation.folios[0];
    const balance = folio ? folio.balance : 0;

    return successResponse({
      reservationId: reservation.id,
      confirmationNumber: reservation.confirmationNumber,
      guest: {
        id: reservation.primaryGuest.id,
        firstName: reservation.primaryGuest.firstName,
        lastName: reservation.primaryGuest.lastName,
        email: reservation.primaryGuest.email,
        phone: reservation.primaryGuest.phone,
        isVip: reservation.primaryGuest.isVip,
        vipLevel: reservation.primaryGuest.vipLevel,
      },
      room: {
        id: id,
        number: room.number,
        status: room.status,
      },
      checkIn: activeAssignment.checkIn,
      checkOut: activeAssignment.checkOut,
      folioBalance: balance,
      currency: folio ? folio.currency : activeAssignment.currency,
      lockCredentials: reservation.lockCredentials,
      reservationStatus: reservation.status,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
