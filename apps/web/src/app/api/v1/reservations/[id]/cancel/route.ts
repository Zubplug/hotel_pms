import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { hasPermission } from '@/lib/rbac';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { NotificationEngine } from '@/lib/notification-engine';
import { requireOrganizationContext } from "@/lib/organization-access";
import { queueCancellationRefunds } from '@/lib/finance/queue-cancellation-refund';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    
    const { id } = await params;
    const body = await req.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
    const reason = body?.reason || 'No reason provided';
    
    // 1. Verify property access and get the existing reservation
    const existingReservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        reservationRooms: true,
        folios: { include: { payments: { include: { refunds: true } } } },
        cancellationPolicy: true,
        property: { select: { organizationId: true } }
      }
    });

    if (!existingReservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    await assertPropertyAccess(session.user.id, existingReservation.propertyId);
    const userRole = String((session.user as any).role || 'STAFF').toUpperCase();
    const isNightAuditor = userRole === 'NIGHT_AUDITOR' || userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'FRONT_DESK';
    const canCancel = await hasPermission(session.user.id, 'reservation', 'delete', existingReservation.propertyId);
    if (!canCancel && !isNightAuditor) return errorResponse('FORBIDDEN', 'Insufficient permissions to cancel reservations', 403);
    if (await isNightAuditTransactionLocked(existingReservation.propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Reservation changes are temporarily paused while Night Audit is posting.', 409);
    }

    // Business Logic: Only CONFIRMED reservations can be cancelled.
    if (existingReservation.status !== 'CONFIRMED') {
      return errorResponse('BAD_REQUEST', `Cannot cancel a reservation that is ${existingReservation.status}`, 400);
    }

    const completedPayments = existingReservation.folios.flatMap(folio => folio.payments).filter(payment => payment.status === 'COMPLETED');
    const totalPaid = completedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const bookedValue = Number((existingReservation.ratePlanSnapshot as any)?.total || 0) || totalPaid;
    const cancellationPolicy = existingReservation.cancellationPolicy;
    const hoursBeforeCheckIn = (new Date(existingReservation.checkIn).getTime() - Date.now()) / 3_600_000;
    let cancellationPenalty = 0;
    if (cancellationPolicy && hoursBeforeCheckIn < cancellationPolicy.hoursBeforeCheckIn) {
      const nights = Math.max(1, Math.round((new Date(existingReservation.checkOut).getTime() - new Date(existingReservation.checkIn).getTime()) / 86_400_000));
      const firstNight = bookedValue / nights;
      cancellationPenalty = cancellationPolicy.penaltyType === 'FIRST_NIGHT'
        ? firstNight
        : cancellationPolicy.penaltyType === 'PERCENTAGE'
          ? bookedValue * Number(cancellationPolicy.penaltyValue) / 100
          : cancellationPolicy.penaltyType === 'FLAT'
            ? Number(cancellationPolicy.penaltyValue)
            : cancellationPolicy.type === 'NON_REFUNDABLE' ? bookedValue : 0;
    }
    cancellationPenalty = Math.min(Math.max(0, cancellationPenalty), totalPaid);

    // 2. Perform transactional cancellation
    const cancelled = await prisma.$transaction(async (tx: any) => {
      let updatedResRoom = null;
      if (existingReservation.reservationRooms.length > 0) {
        updatedResRoom = await tx.reservationRoom.updateMany({
          where: { reservationId: id, status: 'ACTIVE' },
          data: { status: 'CANCELLED' }
        });
      }

      const updatedRes = await tx.reservation.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledBy: session.user.id,
        }
      });

      for (const reservationRoom of existingReservation.reservationRooms) {
        const otherActive = await tx.reservationRoom.findFirst({
          where: {
            roomId: reservationRoom.roomId,
            status: 'ACTIVE',
            reservationId: { not: id },
            checkIn: { lt: existingReservation.checkOut },
            checkOut: { gt: existingReservation.checkIn },
          },
        });
        if (!otherActive) {
          await tx.room.update({ where: { id: reservationRoom.roomId }, data: { status: 'AVAILABLE' } });
        }
      }

      const organizationId = existingReservation.property.organizationId;
      const propertyId = existingReservation.propertyId;

      await tx.auditLog.create({
        data: {
          organizationId,
          propertyId: (typeof reqPropertyId !== "undefined" ? reqPropertyId : ctx.propertyIds[0]),
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: (session.user as any).role || 'STAFF',
          action: 'RESERVATION_CANCELLED',
          resource: 'Reservation',
          resourceId: id,
          previousValue: { status: existingReservation.status },
          newValue: { status: 'CANCELLED', reason },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        },
      });

      const refundRequests = await queueCancellationRefunds({
        tx,
        reservation: { ...existingReservation, folios: existingReservation.folios },
        propertyId: existingReservation.propertyId,
        organizationId,
        requestedById: session.user.id,
        cancellationPenalty,
        totalPaid,
        reason: `${reason}${cancellationPenalty > 0 ? `; cancellation policy penalty applied: ${cancellationPenalty.toFixed(2)}` : ''}`,
      });

      return { updatedRes, updatedResRoom, organizationId, refundRequests };
    });

    const rateSnapshot = existingReservation.ratePlanSnapshot as any;
    const bookingValue = rateSnapshot?.total || 0;

    await NotificationEngine.emit({
      type: 'SIGNIFICANT_CANCELLATION',
      organizationId: cancelled.organizationId,
      propertyId: existingReservation.propertyId,
      entityType: 'reservation',
      entityId: id,
      idempotencyKey: `sig_cxl_${id}`,
      metadata: {
         bookingValue,
         isVip: false // VIP check can be added later
      }
    });

    await NotificationEngine.emit({
      type: 'RESERVATION_CANCELLED',
      organizationId: cancelled.organizationId,
      propertyId: existingReservation.propertyId,
      entityType: 'reservation',
      entityId: id,
      idempotencyKey: `res_cancelled_${id}`,
      metadata: { reason },
    });

    return successResponse({ ...cancelled.updatedRes, refundRequests: cancelled.refundRequests });
  } catch (err: any) {
    console.error('[Reservation Cancel POST]', err);
    return errorResponse('INTERNAL_ERROR', err.message || 'An unexpected error occurred', 500);
  }
}
