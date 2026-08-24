import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { assertPropertyAccess } from '@/lib/property-access';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';
import { lockOrchestrator } from '@/lib/locks/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { roomId, reservationId } = await req.json();
    if (!roomId || !reservationId) return errorResponse('BAD_REQUEST', 'Room and reservation are required', 400);

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        reservationRooms: { where: { status: 'ACTIVE' }, include: { room: { include: { doorLocks: true } } } },
      },
    });
    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);

    await assertPropertyAccess(session.user.id, reservation.propertyId);

    const assignedRoom = reservation.reservationRooms.find(item => item.roomId === roomId)?.room;
    if (!assignedRoom) return errorResponse('BAD_REQUEST', 'Reservation is not assigned to this room', 400);
    if (!['CHECKED_IN', 'PENDING', 'CONFIRMED'].includes(reservation.status)) {
      return errorResponse('BAD_REQUEST', `Reservation is not eligible for keycard encoding (${reservation.status})`, 400);
    }

    const doorLock = assignedRoom.doorLocks[0] || await prisma.doorLock.create({
      data: {
        propertyId: reservation.propertyId,
        roomId,
        lockCode: `ENCODER-${roomId}`,
        provider: 'DELUNS_ENCODER',
        status: 'ONLINE',
      },
    });

    const operation = await lockOrchestrator.issueCredential({
      reservationId,
      guestId: reservation.primaryGuestId,
      roomId,
      lockId: doorLock.id,
      propertyId: reservation.propertyId,
      type: 'PRIMARY',
      validFrom: new Date(),
      validUntil: new Date(reservation.checkOut),
      idempotencyKey: `KEYCARD_ENCODE:${reservationId}:${new Date(reservation.checkOut).getTime()}`,
    });

    return successResponse({ operation });
  } catch (error: unknown) {
    console.error('[Keycard Encode POST]', error);
    return errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : String(error), 500);
  }
}
