import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { hasPermission } from '@/lib/rbac';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { NotificationEngine } from '@/lib/notification-engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const { id } = await params;
    const body = await req.json();
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
    const canCancel = await hasPermission(session.user.id, 'reservation', 'delete', existingReservation.propertyId);
    if (!canCancel) return errorResponse('FORBIDDEN', 'Insufficient permissions to cancel reservations', 403);
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
        data: { status: 'CANCELLED', cancellationReason: reason }
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
          propertyId,
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

      const refundRequests = [];
      for (const folio of existingReservation.folios) {
        for (const payment of folio.payments) {
          if (payment.status !== 'COMPLETED') continue;
          const refundedAmount = payment.refunds
            .filter((refund: any) => refund.status !== 'FAILED')
            .reduce((sum: number, refund: any) => sum + Number(refund.amount), 0);
          const pending = await tx.refundRequest.aggregate({
            where: { paymentId: payment.id, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING'] as any } },
            _sum: { requestedAmount: true },
          });
          const paymentPenalty = totalPaid > 0 ? cancellationPenalty * Number(payment.amount) / totalPaid : 0;
          const amount = Number(payment.amount) - refundedAmount - Number(pending._sum.requestedAmount || 0) - paymentPenalty;
          if (amount <= 0) continue;

          const idempotencyKey = `reservation_cancel_refund_${id}_${payment.id}`;
          const existingRequest = await tx.refundRequest.findUnique({ where: { idempotencyKey } });
          if (existingRequest) {
            refundRequests.push(existingRequest);
            continue;
          }

          const workflowRules = await tx.refundApprovalRule.findMany({ where: { propertyId, isActive: true }, orderBy: { stepOrder: 'asc' } });
          const matchingRules = workflowRules.filter((rule: any) => (rule.minAmount == null || amount >= Number(rule.minAmount)) && (rule.maxAmount == null || amount <= Number(rule.maxAmount)));
          const firstRule = matchingRules[0];
          const fallbackRoleName = amount > 250000 ? 'FINANCE_MANAGER' : amount > 50000 ? 'MANAGER' : 'FRONT_DESK_MANAGER';
          const role = firstRule?.roleId
            ? await tx.role.findUnique({ where: { id: firstRule.roleId } })
            : await tx.role.findFirst({ where: { organizationId, name: fallbackRoleName } });
          const candidate = firstRule?.approverId
            ? { userId: firstRule.approverId }
            : role
              ? await tx.userRole.findFirst({ where: { roleId: role.id, userId: { not: session.user.id }, OR: [{ propertyId }, { propertyId: null }] }, select: { userId: true } })
              : null;

          const request = await tx.refundRequest.create({
            data: {
              organizationId,
              propertyId,
              reservationId: id,
              folioId: folio.id,
              paymentId: payment.id,
              guestId: existingReservation.primaryGuestId,
              requestedAmount: amount,
              currency: payment.currency,
              requestedMethod: 'ORIGINAL_PAYMENT',
              category: 'RESERVATION_CANCELLED',
              reason: `Reservation cancelled: ${reason}${cancellationPenalty > 0 ? `; policy penalty applied: ${paymentPenalty.toFixed(2)}` : ''}`,
              requestedById: session.user.id,
              currentApproverId: candidate?.userId,
              approvalRoleId: role?.id,
              currentApprovalStep: firstRule?.stepOrder || 1,
              idempotencyKey,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          await tx.approvalRequest.create({
            data: {
              propertyId,
              type: 'REFUND',
              status: 'PENDING',
              requestedBy: session.user.id,
              amount,
              currency: payment.currency,
              reason: request.reason,
              details: { refundRequestId: request.id, category: request.category, requestedAmount: amount, requestedMethod: 'ORIGINAL_PAYMENT', approverRoleId: role?.id, approverId: candidate?.userId, stepOrder: firstRule?.stepOrder || 1 },
              expiresAt: request.expiresAt,
            },
          });
          refundRequests.push(request);
        }
      }

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
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
