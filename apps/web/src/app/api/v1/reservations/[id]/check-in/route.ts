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
    if (!session?.user?.id) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', 401);
    }

    const { id: reservationId } = await params;

    // 1. Fetch Reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        reservationRooms: {
          include: { room: true }
        }
      }
    });

    if (!reservation) {
      return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    }

    // Verify access
    const propertyId = reservation.propertyId;
    await assertPropertyAccess(session.user.id, propertyId);

    if (reservation.status !== 'CONFIRMED') {
      return errorResponse('BAD_REQUEST', 'Reservation must be in CONFIRMED status to check in.', 400);
    }

    // 2. Validate Room Assignment
    const resRoom = reservation.reservationRooms[0];
    if (!resRoom || !resRoom.room) {
      return errorResponse('BAD_REQUEST', 'A specific room must be assigned before checking in.', 400);
    }

    // 3. Hardware Readiness Guard
    const agent = await prisma.hardwareAgent.findFirst({
      where: { propertyId, enabled: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!agent) {
      return errorResponse('BAD_REQUEST', 'No hardware agent configured for this property.', 400);
    }
    if (agent.status !== 'ONLINE') {
      return errorResponse('BAD_REQUEST', 'Hardware agent is OFFLINE. Physical card encoding is required.', 400);
    }
    if (agent.hardwareStatus !== 'READY') {
      return errorResponse('BAD_REQUEST', `Encoder is ${agent.hardwareStatus}. Please check USB connection.`, 400);
    }

    // 4. Idempotency Check (Don't double-queue)
    const idempotencyKey = `CHECKIN:${reservationId}`;
    const existingOperation = await prisma.lockOperation.findUnique({
      where: { idempotencyKey }
    });

    if (existingOperation) {
      if (['QUEUED', 'DISPATCHING', 'WAITING_FOR_CARD', 'CARD_DETECTED', 'ENCODING'].includes(existingOperation.status)) {
        return successResponse({ operationId: existingOperation.id, status: existingOperation.status, message: 'Existing operation in progress' });
      }
    }

    // 5. Create the Operation and Command Atomically
    const newOperation = await prisma.$transaction(async (tx) => {
      // Ensure a DoorLock entity exists for this room to satisfy the lockId constraint
      let doorLock = await tx.doorLock.findFirst({ where: { roomId: resRoom.room!.id } });
      if (!doorLock) {
        doorLock = await tx.doorLock.create({
          data: {
            propertyId,
            roomId: resRoom.room!.id,
            lockCode: `ENCODER-${resRoom.room!.id}`,
            provider: 'DELUNS_ENCODER',
            status: 'ONLINE'
          }
        });
      }

      const op = await tx.lockOperation.create({
        data: {
          idempotencyKey: idempotencyKey,
          propertyId,
          lockId: doorLock.id,
          roomId: resRoom.room!.id,
          reservationId: reservation.id,
          operation: 'ENCODE_CARD',
          status: 'QUEUED',
        }
      });

      // Format as un-zoned local strings so C# DateTime.TryParse treats it as exactly this string.
      // For checkIn, sending empty forces the encoder PC to use its exact current local time.
      const yyyy = resRoom.checkOut.getFullYear();
      const mm = String(resRoom.checkOut.getMonth() + 1).padStart(2, '0');
      const dd = String(resRoom.checkOut.getDate()).padStart(2, '0');
      
      const payload = {
        roomNo: resRoom.room!.number,
        checkIn: "", // Empty string = SDK uses current local time automatically
        checkOut: `${yyyy}-${mm}-${dd} 12:00:00`, // Force 12:00 PM local time
        flags: 8 // 8 = "Replace old card" (invalidates previous guests for this room)
      };

      const cmd = await tx.lockCommand.create({
        data: {
          operationId: op.id,
          agentId: agent.id,
          commandType: 'ENCODE',
          payload: payload,
          status: 'QUEUED'
        }
      });

      const updatedOp = await tx.lockOperation.update({
        where: { id: op.id },
        data: { commandId: cmd.id }
      });

      return updatedOp;
    });

    return successResponse({ operationId: newOperation.id, status: newOperation.status });

  } catch (err) {
    console.error('[Check-In API Error]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error during check-in', 500);
  }
}
