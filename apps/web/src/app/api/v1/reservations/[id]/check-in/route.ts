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
        property: true,
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

    // Payment validation moved into the atomic transaction

    // 4. Hardware Readiness Guard
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

    // 5. Idempotency Check (Don't double-queue)
    const idempotencyKey = `CHECKIN:${reservationId}`;
    const existingOperation = await prisma.lockOperation.findUnique({
      where: { idempotencyKey }
    });

    if (existingOperation) {
      if (['QUEUED', 'DISPATCHING', 'WAITING_FOR_CARD', 'CARD_DETECTED', 'ENCODING'].includes(existingOperation.status)) {
        return successResponse({ operationId: existingOperation.id, status: existingOperation.status, message: 'Existing operation in progress' });
      }
    }

    // 6. Create the Operation, Command, and Audit Log Atomically
    const newOperation = await prisma.$transaction(async (tx) => {
      // --- 7D.6 FINANCIAL GUARD ---
      // Lock the folios associated with this reservation to prevent concurrent mutations
      const folios = await tx.$queryRaw<any[]>`
        SELECT id, balance, version 
        FROM "Folio" 
        WHERE "reservationId" = ${reservationId}::uuid 
        FOR UPDATE
      `;

      let totalBalance = 0;
      for (const folio of folios) {
        totalBalance += Number(folio.balance);
      }

      if (totalBalance > 0) {
        throw new Error('PAYMENT_REQUIRED');
      }
      // ----------------------------

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
          metadata: {
            initiatedBy: session.user.id,
            initiatedByEmail: session.user.email,
            initiatedByRole: (session.user as any).role || 'STAFF'
          }
        }
      });

      // Calculate current time in Nigeria (UTC+1)
      const now = new Date();
      now.setUTCHours(now.getUTCHours() + 1);
      
      const formatNigeriaTime = (d: Date, forceTime?: string) => {
        const yyyy = d.getUTCFullYear();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mmm = months[d.getUTCMonth()];
        const dd = String(d.getUTCDate()).padStart(2, '0');
        if (forceTime) return `${dd} ${mmm} ${yyyy} ${forceTime}`;
        
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const min = String(d.getUTCMinutes()).padStart(2, '0');
        const ss = String(d.getUTCSeconds()).padStart(2, '0');
        return `${dd} ${mmm} ${yyyy} ${hh}:${min}:${ss}`;
      };

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

      // Write the Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: reservation.property.organizationId,
          propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: (session.user as any).role || 'STAFF',
          action: 'LOCK_OPERATION_QUEUED',
          resource: 'Reservation',
          resourceId: reservation.id,
          newValue: { lockOperationId: op.id, roomId: resRoom.room!.id },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        }
      });

      return updatedOp;
    });

    return successResponse({ operationId: newOperation.id, status: newOperation.status });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Check-In API Error]', err);

    if (message === 'PAYMENT_REQUIRED') {
      return errorResponse('PAYMENT_REQUIRED', `Check-in blocked: Outstanding balance must be paid first.`, 402);
    }

    return errorResponse('INTERNAL_ERROR', 'Unexpected error during check-in', 500);
  }
}
