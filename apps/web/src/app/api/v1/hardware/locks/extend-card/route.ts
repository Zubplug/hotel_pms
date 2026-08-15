import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import prisma from '@hotel-pms/db';
import { lockOrchestrator } from '@/lib/locks/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId, reservationId, readOperationId } = body;

    if (!propertyId || !reservationId || !readOperationId) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    // 1. Verify the reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        reservationRooms: {
          where: { status: 'ACTIVE' },
          include: { room: { include: { doorLocks: true } } },
        },
      },
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);

    await assertPropertyAccess(session.user.id, reservation.propertyId);

    const firstRoom = reservation.reservationRooms[0]?.room;
    if (!firstRoom) return errorResponse('BAD_REQUEST', 'No active room assigned to this reservation', 400);

    const doorLock = firstRoom.doorLocks[0];
    if (!doorLock) return errorResponse('BAD_REQUEST', `No door lock configured for room ${firstRoom.number}`, 400);

    // 2. Verify the Read Operation
    const readOp = await prisma.lockOperation.findUnique({
      where: { id: readOperationId },
      include: { command: true }
    });

    if (!readOp || (readOp.status !== 'SUCCESS' && readOp.status !== 'COMPLETED') || !readOp.command?.responseData) {
      return errorResponse('BAD_REQUEST', 'Invalid or incomplete read operation provided', 400);
    }

    const cardData = readOp.command.responseData as { roomNo?: string; cardSnr?: string };
    
    if (!cardData.roomNo) {
      return errorResponse('BAD_REQUEST', 'Read operation did not return a room number', 400);
    }

    // Validate that the card belongs to the correct room.
    // The hardware might return roomNo in a padded format (e.g. '0101' for '101'). 
    // Usually it strips leading zeros or we can do a loose match.
    // Assuming exact match or loose number match.
    const cardRoomStr = String(cardData.roomNo).replace(/^0+/, '');
    const dbRoomStr = String(firstRoom.number).replace(/^0+/, '');
    
    if (cardRoomStr !== dbRoomStr) {
      return errorResponse('CONFLICT', `Card belongs to room ${cardData.roomNo}, expected room ${firstRoom.number}. Do not overwrite active cards from other rooms.`, 409);
    }

    // 3. Dispatch ENCODE operation
    const idempotencyKey = `EXTEND_CARD:${reservation.id}:${Date.now()}`;
    const op = await lockOrchestrator.issueCredential({
      reservationId: reservation.id,
      guestId: reservation.primaryGuestId,
      roomId: firstRoom.id,
      lockId: doorLock.id,
      propertyId,
      type: 'PRIMARY',
      validFrom: new Date(), // It is active from now
      validUntil: new Date(reservation.checkOut),
      idempotencyKey,
    });

    return successResponse({ operation: op });
  } catch (err: unknown) {
    console.error('[Extend Card POST]', err);
    return errorResponse('INTERNAL_ERROR', err instanceof Error ? err.message : String(err), 500);
  }
}
