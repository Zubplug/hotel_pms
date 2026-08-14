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

      // Calculate current time in Nigeria (UTC+1)
      const now = new Date();
      now.setUTCHours(now.getUTCHours() + 1);
      
      const formatNigeriaTime = (d: Date, forceTime?: string) => {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        if (forceTime) return `${yyyy}-${mm}-${dd} ${forceTime}`;
        
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const min = String(d.getUTCMinutes()).padStart(2, '0');
        const ss = String(d.getUTCSeconds()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
      };

      // Calculate current time in Nigeria (UTC+1)
      const now = new Date();
      now.setUTCHours(now.getUTCHours() + 1);

      // Shift checkIn date to Nigeria timezone (to match whatever they selected on the calendar)
      const checkInDate = new Date(resRoom.checkIn);
      checkInDate.setUTCHours(checkInDate.getUTCHours() + 1);

      // Shift checkout date to Nigeria timezone
      const checkOutDate = new Date(resRoom.checkOut);
      checkOutDate.setUTCHours(checkOutDate.getUTCHours() + 1);

      // Extract exactly the time right now (HH:mm:ss)
      const currentHH = String(now.getUTCHours()).padStart(2, '0');
      const currentMin = String(now.getUTCMinutes()).padStart(2, '0');
      const currentSec = String(now.getUTCSeconds()).padStart(2, '0');
      const exactTimeStr = `${currentHH}:${currentMin}:${currentSec}`;

      const payload = {
        roomNo: resRoom.room!.number,
        checkIn: formatNigeriaTime(checkInDate, exactTimeStr), // Date from calendar + Exact current time!
        checkOut: formatNigeriaTime(checkOutDate, '12:00:00'), // 12:00 PM on checkout day
        flags: 0 // 0 = "Replace old card" in Deluns lock system
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
