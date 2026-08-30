import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess } from '@/lib/property-access';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { lockOrchestrator } from '@/lib/locks/orchestrator';
import crypto from 'crypto';
import { NotificationEngine } from '@/lib/notification-engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      select: { id: true, status: true, propertyId: true, reservationRooms: { include: { room: true } } },
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    if (reservation.status !== 'CHECKED_IN') {
      return errorResponse('INVALID_STATE', `Cannot check out a reservation with status ${reservation.status}`, 409);
    }

    await assertPropertyAccess(session.user.id, reservation.propertyId);
    if (await isNightAuditTransactionLocked(reservation.propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Check-out is temporarily paused while Night Audit is posting.', 409);
    }
    const userRole = String((session.user as any).role || 'STAFF').toUpperCase();
    const isNightAuditor = userRole === 'NIGHT_AUDITOR' || userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const canCheckOut = await hasPermission(session.user.id, 'reservation', 'update', reservation.propertyId);
    if (!canCheckOut && !isNightAuditor) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    // Run the operational checkout transaction
    const txResult = await prisma.$transaction(async (tx: any) => {
      // 1. Verify and Lock Financial State (Check Folios)
      // Note: In Postgres, FOR UPDATE ensures that concurrent transactions modifying these folios are blocked.
      const folios = await tx.$queryRaw<any[]>`
        SELECT id, balance, version 
        FROM "Folio" 
        WHERE "reservationId" = ${id}::uuid 
        FOR UPDATE
      `;

      let totalBalance = 0;
      for (const folio of folios) {
        totalBalance += Number(folio.balance);
      }

      if (totalBalance > 0) {
        throw new Error('PAYMENT_REQUIRED');
      } else if (totalBalance < 0) {
        throw new Error('REFUND_REQUIRED');
      }

      // 2. Transition reservation to CHECKED_OUT
      await tx.reservation.update({
        where: { id },
        data: { status: 'CHECKED_OUT' },
      });

      // 3. Start room cleaning and create housekeeping tasks
      const businessDate = new Date();
      businessDate.setUTCHours(0, 0, 0, 0); // Simplified business date
      
      let tasksCreated = 0;
      for (const rr of reservation.reservationRooms) {
        if (rr.room) {
          // Check for back-to-back same day arrivals for HIGH priority
          const nextReservation = await tx.reservationRoom.findFirst({
            where: {
              roomId: rr.room.id,
              checkIn: {
                gte: businessDate,
                lt: new Date(businessDate.getTime() + 86400000)
              },
              reservation: { status: 'CONFIRMED' }
            },
            include: { reservation: { include: { priorities: true } } }
          });
          
          let priority = 'NORMAL';
          if (nextReservation) {
            priority = 'HIGH';
            if (nextReservation.reservation.priorities?.some((p: any) => p.type === 'VIP' || p.type === 'MANAGEMENT')) {
              priority = 'CRITICAL';
            }
          }

          await tx.room.update({
            where: { id: rr.room.id },
            data: { status: 'CLEANING', housekeepingStatus: 'CLEANING' },
          });

          // Idempotency: upsert by unique idempotencyKey
          const idempotencyKey = `CHECKOUT_${id}_${rr.room.id}`;
          const hskTask = await tx.housekeepingTask.upsert({
            where: { idempotencyKey },
            update: { status: 'CLEANING', startedAt: new Date() },
            create: {
              idempotencyKey,
              propertyId: reservation.propertyId,
              roomId: rr.room.id,
              type: 'CHECKOUT',
              priority,
              status: 'CLEANING',
              startedAt: new Date(),
              businessDate,
              notes: priority === 'HIGH' ? 'Back-to-back arrival expected today.' : null
            }
          });
          
          if (hskTask.createdAt >= businessDate) { // Rough check if just created
            tasksCreated++;
          }
        }
      }

      // 4. Close the Folios
      for (const folio of folios) {
        await tx.folio.update({
          where: { id: folio.id, version: folio.version },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closedBy: session.user.id,
            version: { increment: 1 }
          }
        });
      }

      // 5. Audit Logging
      const property = await tx.property.findUnique({ where: { id: reservation.propertyId } });
      if (property) {
        await tx.auditLog.create({
          data: {
            organizationId: property.organizationId,
            propertyId: property.id,
            userId: session.user.id,
            userEmail: session.user.email,
            userRole: (session.user as any).role || 'STAFF',
            action: 'RESERVATION_CHECKED_OUT',
            resource: 'Reservation',
            resourceId: id,
            newValue: { status: 'CHECKED_OUT', foliosClosed: folios.length, housekeepingTasksQueued: tasksCreated },
            ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
            userAgent: req.headers.get('user-agent') || 'Unknown',
            requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
          }
        });
      }
      return property;
    });

    if (txResult) {
      await NotificationEngine.emit({
        type: 'CHECK_OUT',
        organizationId: txResult.organizationId,
        propertyId: reservation.propertyId,
        entityType: 'reservation',
        entityId: id,
        idempotencyKey: `checkout_${id}_${Date.now()}`
      });
    }

    // 6. Queue credential revocation (non-blocking)
    let revokedCount = 0;
    try {
      revokedCount = await lockOrchestrator.revokeReservationCredentials(id, reservation.propertyId);
    } catch (hwErr) {
      console.error('[Check-Out] Revocation dispatch failed (non-blocking):', hwErr);
    }

    return successResponse({
      message: 'Check-out complete.',
      revokedCredentials: revokedCount,
      revocationStatus: revokedCount > 0 ? 'QUEUED' : 'NONE',
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Check-Out POST]', err);

    if (message === 'PAYMENT_REQUIRED') {
      return errorResponse('PAYMENT_REQUIRED', 'Guest must settle outstanding balance before check-out.', 402);
    }
    if (message === 'REFUND_REQUIRED') {
      return errorResponse('PAYMENT_REQUIRED', 'Guest has a credit balance. Please process a refund before check-out.', 402);
    }

    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}
