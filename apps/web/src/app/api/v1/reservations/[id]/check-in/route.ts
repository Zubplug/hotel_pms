import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { assertPropertyAccess } from '@/lib/property-access';
import { hasPermission } from '@/lib/rbac';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { requireOrganizationContext } from "@/lib/organization-access";
import { CityLedgerAccountingService } from '@/lib/services/city-ledger-accounting-service';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { NotificationEngine } from '@/lib/notification-engine';

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
    
    let overrideDeposit = false;
    let acknowledgedByStaffId: string | undefined;
    let reason: string | undefined;
    let emergency = false;

    try {
      const body = await req.json();
      let reqPropertyId = body?.propertyId;
      overrideDeposit = body?.overrideDeposit === true;
      acknowledgedByStaffId = body?.acknowledgedByStaffId;
      reason = typeof body?.reason === 'string' ? body.reason.trim() : undefined;
      emergency = body?.emergency === true;
      if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
    } catch (e) {
      // Ignore body parsing errors
    }

    if (emergency && (!reason || reason.trim().length < 10)) {
      return errorResponse('INVALID_REQUEST', 'A clear reason of at least 10 characters is required for emergency check-in.', 400);
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
    if (emergency) {
      const existingEmergency = await prisma.frontdeskEmergencyOperation.findUnique({
        where: { idempotencyKey: `EMERGENCY_CHECKIN:${reservationId}` },
      });
      if (existingEmergency) return successResponse(existingEmergency);
    }
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

    // An emergency browser check-in completes the cloud stay operation now.
    // Only the physical card remains pending for the desktop terminal.
    const idempotencyKey = emergency
      ? `EMERGENCY_CHECKIN:${reservationId}`
      : `CHECKIN:${reservationId}`;

    // 4. Hardware Readiness Guard (not required for emergency cloud completion)
    const agent = await prisma.hardwareAgent.findFirst({
      where: { propertyId, enabled: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!emergency && !agent) {
      return errorResponse('BAD_REQUEST', 'No hardware agent configured for this property.', 400);
    }
    if (!emergency && agent && agent.status !== 'ONLINE') {
      return errorResponse('BAD_REQUEST', 'Hardware agent is OFFLINE. Physical card encoding is required.', 400);
    }
    if (!emergency && agent && agent.hardwareStatus !== 'READY') {
      return errorResponse('BAD_REQUEST', `Encoder is ${agent.hardwareStatus}. Please check USB connection.`, 400);
    }

    // 5. Idempotency Check (Don't double-queue)
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
      const generatedOpId = crypto.randomUUID();
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
          where: reservation.corporateAccount
            ? { corporateAccountId: reservation.corporateAccount.id, propertyId, type: 'CITY_LEDGER', status: 'OPEN' }
            : { reservationId },
          include: {
            charges: true,
            payments: true,
            credits: { where: { status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] }, remainingAmount: { gt: 0 } } },
          }
        });

        if (reservation.corporateAccount?.cityLedgerAccountId) {
          await tx.$queryRaw<any[]>`
            SELECT id
            FROM "CityLedgerAccount"
            WHERE id = ${reservation.corporateAccount.cityLedgerAccountId}::uuid
            FOR UPDATE
          `;
          totalCredit += await CityLedgerAccountingService.getAvailableCorporateAdvance(tx, {
            accountId: reservation.corporateAccount.cityLedgerAccountId,
            currency: reservation.currency,
          });
        }
        
        for (const f of dbFolios) {
          if (reservation.corporateAccount) {
            totalCredit += f.credits.reduce((sum: number, credit: any) => sum + Number(credit.remainingAmount), 0);
            totalDebt += Math.max(0, Number(f.balance || 0));
            continue;
          }
          const fCharges = f.charges.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
          const fPayments = f.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
          const fBalance = fCharges - fPayments;
          if (fBalance > 0) totalDebt += fBalance;
          else if (fBalance < 0) totalCredit += Math.abs(fBalance);
        }

        if (totalDebt > 0 || totalCredit < expectedCost) {
           if (overrideDeposit) {
             if (!acknowledgedByStaffId || !reason) {
               throw new Error('BAD_REQUEST: Missing required fields for deposit override');
             }
             
             // Validate staff exists and belongs to property
             const staff = await tx.staff.findFirst({ where: { id: acknowledgedByStaffId, propertyId }});
             if (!staff) {
               throw new Error('BAD_REQUEST: Invalid acknowledging staff ID');
             }

             // Find staff record for current user
             const currentStaff = await tx.staff.findUnique({ where: { userId: session.user.id } });
             if (!currentStaff) {
               throw new Error('BAD_REQUEST: User is not associated with a staff record');
             }

             // Find currently open frontdesk session for the operator
             const operatorSession = await tx.frontdeskSession.findFirst({
               where: { propertyId, staffId: currentStaff.id, controlStatus: 'OPEN' }
             });
             if (!operatorSession) {
               throw new Error('BAD_REQUEST: You must have an open Front Desk shift to bypass deposit.');
             }

             // Idempotency check for bypass
             const existingBypass = await tx.checkInBypass.findUnique({
               where: { operationId: generatedOpId }
             });

             if (!existingBypass) {
               await tx.checkInBypass.create({
                 data: {
                   operationId: generatedOpId,
                   propertyId,
                   reservationId,
                   frontdeskSessionId: operatorSession.id,
                   operatorId: currentStaff.id,
                   acknowledgedByStaffId,
                   reason,
                   status: 'PENDING',
                   businessDate: operatorSession.businessDate,
                 }
               });
             }
           } else {
             throw new Error('PAYMENT_REQUIRED: Insufficient Deposit to cover Check-In.');
           }
        }
      }
      // ----------------------------

      if (reservation.corporateAccount && Number(reservation.corporateAccount.creditLimit) > 0 && !reservation.corporateAccount.exemptFromHighBalance) {
        const corporateFolio = await tx.folio.findFirst({
          where: { corporateAccountId: reservation.corporateAccount.id, propertyId, type: 'CITY_LEDGER', status: 'OPEN' },
          select: { balance: true },
        });
        const expectedCost = Number((reservation.ratePlanSnapshot as any)?.total || 0);
        if (Number(corporateFolio?.balance || 0) + expectedCost > Number(reservation.corporateAccount.creditLimit)) {
          throw new Error('CREDIT_LIMIT_EXCEEDED: The projected reservation charges exceed the corporate account credit limit.');
        }
      }

      if (emergency) {
        const doorLock = await tx.doorLock.findFirst({ where: { roomId: resRoom.room!.id } }) || await tx.doorLock.create({
          data: {
            propertyId,
            roomId: resRoom.room!.id,
            lockCode: `ENCODER-${resRoom.room!.id}`,
            provider: 'DELUNS_ENCODER',
            status: 'OFFLINE',
            metadata: { source: 'ONLINE_FRONTDESK_EMERGENCY' },
          },
        });

        const op = await tx.lockOperation.create({
          data: {
            id: generatedOpId,
            idempotencyKey,
            propertyId,
            lockId: doorLock.id,
            roomId: resRoom.room!.id,
            reservationId: reservation.id,
            operation: 'ENCODE_CARD',
            status: 'WAITING_FOR_AUDIT_APPROVAL',
            metadata: {
              source: 'ONLINE_FRONTDESK_EMERGENCY',
              roomId: resRoom.room!.id,
              initiatedBy: session.user.id,
              initiatedByEmail: session.user.email,
              initiatedByRole: (session.user as any).role || 'STAFF',
              reason: reason || 'Desktop terminal unavailable',
            },
          },
        });

        await tx.lockCredential.create({
          data: {
            reservationId: reservation.id,
            guestId: reservation.primaryGuestId,
            roomId: resRoom.room!.id,
            lockId: doorLock.id,
            credentialType: 'rfid',
            status: 'PENDING',
            validFrom: new Date(),
            validUntil: reservation.checkOut,
            issueOperationId: op.id,
            metadata: { source: 'ONLINE_FRONTDESK_EMERGENCY' },
          },
        });

        await tx.reservation.update({ where: { id: reservation.id }, data: { status: 'CHECKED_IN' } });
        await tx.room.update({ where: { id: resRoom.room!.id }, data: { status: 'OCCUPIED' } });

        const businessDate = reservation.property.businessDate || getPropertyBusinessDate(reservation.property.timezone);
        const emergencyOperation = await tx.frontdeskEmergencyOperation.upsert({
          where: { idempotencyKey },
          create: {
            propertyId,
            reservationId: reservation.id,
            operationType: 'CHECK_IN',
            status: 'PENDING_NIGHT_AUDIT_REVIEW',
            idempotencyKey,
            reason: reason || 'Desktop terminal unavailable',
            requestedByUserId: session.user.id,
            businessDate,
            cardEncodingRequired: true,
            cardEncodingStatus: 'AWAITING_NIGHT_AUDIT_APPROVAL',
            cloudCompletedAt: new Date(),
            metadata: { source: 'ONLINE_FRONTDESK_EMERGENCY', lockOperationId: op.id, roomId: resRoom.room!.id, previousRoomStatus: resRoom.room!.status },
          },
          update: { status: 'PENDING_NIGHT_AUDIT_REVIEW', cardEncodingStatus: 'AWAITING_NIGHT_AUDIT_APPROVAL' },
        });

        await tx.auditLog.createMany({ data: [
          {
            organizationId: reservation.property.organizationId,
            propertyId,
            userId: session.user.id,
            userEmail: session.user.email,
            userRole: (session.user as any).role || 'STAFF',
            action: 'RESERVATION_CHECKED_IN',
            resource: 'Reservation',
            resourceId: reservation.id,
            newValue: { status: 'CHECKED_IN', source: 'ONLINE_FRONTDESK_EMERGENCY', hardwareStatus: 'PENDING_DESKTOP_ENCODING' },
            ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
            userAgent: req.headers.get('user-agent') || 'Unknown',
            requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
          },
          {
            organizationId: reservation.property.organizationId,
            propertyId,
            userId: session.user.id,
            userEmail: session.user.email,
            userRole: (session.user as any).role || 'STAFF',
            action: 'FRONTDESK_EMERGENCY_CHECK_IN_COMPLETED',
            resource: 'FrontdeskEmergencyOperation',
            resourceId: emergencyOperation.id,
            newValue: { reservationId: reservation.id, hardwareStatus: 'PENDING_DESKTOP_ENCODING' },
            ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
            userAgent: req.headers.get('user-agent') || 'Unknown',
            requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
          },
        ] });

        return { id: emergencyOperation.id, status: emergencyOperation.status, hardwareStatus: 'PENDING_DESKTOP_ENCODING' };
      }

      if (!agent) throw new Error('No hardware agent configured for this property.');


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
          id: generatedOpId,
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

    if (emergency) {
      await NotificationEngine.emit({
        type: 'CHECK_IN',
        organizationId: reservation.property.organizationId,
        propertyId,
        entityType: 'reservation',
        entityId: reservationId,
        idempotencyKey: `emergency_checkin_${reservationId}`,
      });
    }

    return successResponse({
      operationId: newOperation.id,
      status: newOperation.status,
      ...(emergency ? { cloudStatus: 'COMPLETED', hardwareStatus: 'PENDING_DESKTOP_ENCODING' } : {}),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Check-In API Error]', err);

    if (message.includes('PAYMENT_REQUIRED')) {
      return errorResponse('PAYMENT_REQUIRED', `Check-in blocked: Outstanding balance must be paid first.`, 402);
    }

    return errorResponse('INTERNAL_ERROR', 'Unexpected error during check-in', 500);
  }
}
