import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { assertPropertyAccess } from '@/lib/property-access';
import { hasPermission } from '@/lib/rbac';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', 401);
    }
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const { id: reservationId } = await params;
    
    try {
      const body = await req.json();
      let reqPropertyId = body?.propertyId;
      if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
    } catch (e) {
      // Ignore body parsing errors
    }

    // 1. Fetch Reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        property: true,
        corporateAccount: true,
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
    const canCheckIn = await hasPermission(session.user.id, 'reservation', 'update', propertyId);
    if (!canCheckIn) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    if (await isNightAuditTransactionLocked(propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Check-in is temporarily paused while Night Audit is posting.', 409);
    }

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
    const newOperation = await prisma.$transaction(async (tx: any) => {
      // --- 7D.6 FINANCIAL GUARD ---
      // Lock the folios associated with this reservation to prevent concurrent mutations
      const folios = await tx.$queryRaw<any[]>`
        SELECT id, balance, version 
        FROM "Folio" 
        WHERE "reservationId" = ${reservationId}::uuid 
        FOR UPDATE
      `;

      // 7D.6 FINANCIAL GUARD: ENFORCE DEPOSIT REQUIREMENT (STRICT)
      // We must check if the wallet's available credit covers the expected cost.
      
      let requireDeposit = true;
      if (reservation.corporateAccount && reservation.corporateAccount.depositPolicy === 'WAIVED') {
        requireDeposit = false;
      }

      if (requireDeposit && reservation.ratePlanSnapshot) {
        const snapshot = reservation.ratePlanSnapshot as any;
        const expectedCost = snapshot.total || 0;
        
        let totalCredit = 0;
        let totalDebt = 0;
        
        const dbFolios = await tx.folio.findMany({
          where: { reservationId },
          include: { charges: true, payments: true }
        });
        
        for (const f of dbFolios) {
          const fCharges = f.charges.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
          const fPayments = f.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
          const fBalance = fCharges - fPayments;
          if (fBalance > 0) totalDebt += fBalance;
          else if (fBalance < 0) totalCredit += Math.abs(fBalance);
        }

        if (totalDebt > 0 || totalCredit < expectedCost) {
           throw new Error('PAYMENT_REQUIRED: Insufficient Deposit to cover Check-In.');
        }
      }
      // ----------------------------

      // Ensure a DoorLock entity exists for this room to satisfy the lockId constraint
      let doorLock = await tx.doorLock.findFirst({ where: { roomId: resRoom.room!.id } });
      if (!doorLock) {
        doorLock = await tx.doorLock.create({
          data: { propertyId,
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
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        if (forceTime) return `${yyyy}-${mm}-${dd}T${forceTime}`;
        
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const min = String(d.getUTCMinutes()).padStart(2, '0');
        const ss = String(d.getUTCSeconds()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
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

    if (message.includes('PAYMENT_REQUIRED')) {
      return errorResponse('PAYMENT_REQUIRED', `Check-in blocked: Outstanding balance must be paid first.`, 402);
    }

    return errorResponse('INTERNAL_ERROR', 'Unexpected error during check-in', 500);
  }
}
