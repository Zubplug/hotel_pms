import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { assertPropertyAccess } from '@/lib/property-access';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    const { newCheckoutDate } = await req.json();

    if (!newCheckoutDate) {
      return errorResponse('BAD_REQUEST', 'Missing newCheckoutDate', 400);
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        reservationRooms: true,
      }
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);

    await assertPropertyAccess(session.user.id, reservation.propertyId);

    if (reservation.status !== 'CHECKED_IN') {
      return errorResponse('BAD_REQUEST', 'Only checked-in reservations can be extended', 400);
    }

    const resRoom = reservation.reservationRooms[0];
    if (!resRoom) {
      return errorResponse('BAD_REQUEST', 'No room assigned to reservation', 400);
    }

    const currentCheckOut = new Date(resRoom.checkOut);
    const requestedCheckOut = new Date(newCheckoutDate);

    // Normalize dates to midnight
    currentCheckOut.setHours(0, 0, 0, 0);
    requestedCheckOut.setHours(0, 0, 0, 0);

    if (requestedCheckOut <= currentCheckOut) {
      return errorResponse('BAD_REQUEST', 'New checkout date must be after current checkout date', 400);
    }

    const timeDiff = requestedCheckOut.getTime() - currentCheckOut.getTime();
    const additionalNights = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Use stored rate amount — this is the authoritative nightly rate for this reservation
    const currentRate = resRoom.rateAmount;
    const additionalCharge = Number(currentRate) * additionalNights;

    // Check availability — look for conflicting reservations in the extension window
    const overlapping = await prisma.reservationRoom.findFirst({
      where: {
        roomId: resRoom.roomId,
        reservationId: { not: reservation.id },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        checkIn: { lt: requestedCheckOut },
        checkOut: { gt: currentCheckOut },
      }
    });

    if (overlapping) {
      return errorResponse('CONFLICT', 'Room is not available for the extended dates', 409);
    }

    return successResponse({
      currentCheckOut: resRoom.checkOut,
      newCheckOut: requestedCheckOut,
      additionalNights,
      ratePerNight: currentRate,
      additionalCharge,
      currency: resRoom.currency,
    });

  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'FORBIDDEN') return errorResponse('FORBIDDEN', (err as Error).message, 403);
    console.error('[Extend Preview POST]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
