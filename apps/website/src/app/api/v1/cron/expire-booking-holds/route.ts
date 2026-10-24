// Expires unpaid booking holds and their pending reservations.
// Accepts GET for Vercel Cron and POST for external schedulers.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { getOrCreateBookingSystemActor } from '@/lib/booking-engine/system-actor';
import { sendBookingExpiredEmail } from '@/lib/email/booking-emails';
import { NotificationEngine } from '@/lib/notification-engine';

export const dynamic = 'force-dynamic';

async function expire(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || supplied !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const holds = await prisma.bookingHold.findMany({
    where: { status: 'ACTIVE', expiresAt: { lt: now } },
    select: { id: true, organizationId: true, propertyId: true, expiresAt: true },
    orderBy: { expiresAt: 'asc' },
    take: 100,
  });
  const expired: Array<{ holdId: string; reservationId?: string; confirmationNumber?: string }> = [];
  const paidPending: string[] = [];

  for (const hold of holds) {
    try {
      const actorId = await getOrCreateBookingSystemActor(prisma as any, hold.organizationId);
      const result = await prisma.$transaction(async (tx: any) => {
        // Claim the hold first. A concurrent booking conversion or payment
        // workflow that already claimed it wins and this run becomes a no-op.
        const claimed = await tx.bookingHold.updateMany({
          where: { id: hold.id, status: 'ACTIVE', expiresAt: { lt: now } },
          data: { status: 'EXPIRED' },
        });
        if (claimed.count !== 1) return { kind: 'SKIPPED' as const };

        const reservation = await tx.reservation.findFirst({
          where: { bookingChannelRef: hold.id, propertyId: hold.propertyId },
          include: {
            primaryGuest: { select: { email: true } },
            property: { select: { name: true } },
            reservationRooms: { select: { id: true, roomId: true, checkIn: true, checkOut: true } },
            payments: { select: { status: true, amount: true } },
          },
        });
        if (!reservation) return { kind: 'SKIPPED' as const };
        if (reservation.status !== 'PENDING') {
          if (reservation.status === 'CONFIRMED') await tx.bookingHold.update({ where: { id: hold.id }, data: { status: 'CONVERTED' } });
          return { kind: 'SKIPPED' as const };
        }

        const successfulGatewayPayment = await tx.bookingPaymentTransaction.findFirst({ where: { reservationId: reservation.id, status: 'SUCCESS' }, select: { id: true } });
        const hasSuccessfulPayment = reservation.payments.some((payment: any) => ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(String(payment.status)))
          || Boolean(successfulGatewayPayment);
        if (hasSuccessfulPayment) {
          // Do not cancel a paid booking. The payment webhook owns the final
          // confirmation transition; leave an audit trail for investigation.
          await tx.bookingHold.update({ where: { id: hold.id }, data: { status: 'CONVERTED' } });
          await tx.auditLog.create({
            data: {
              organizationId: hold.organizationId,
              propertyId: hold.propertyId,
              userId: actorId,
              userEmail: 'booking.system@lodgecore.internal',
              userRole: 'SYSTEM',
              action: 'EXPIRED_HOLD_PAYMENT_PENDING_CONFIRMATION',
              resource: 'BookingHold',
              resourceId: hold.id,
              newValue: { reservationId: reservation.id, status: reservation.status },
              requestId: `expire-hold-paid:${hold.id}`,
            },
          });
          return { kind: 'PAID_PENDING' as const, reservationId: reservation.id };
        }

        const cancelled = await tx.reservation.updateMany({
          where: { id: reservation.id, status: 'PENDING' },
          data: { status: 'EXPIRED', cancellationReason: 'Payment window expired before payment was completed.' },
        });
        if (cancelled.count !== 1) return { kind: 'SKIPPED' as const };

        await tx.reservationRoom.updateMany({ where: { reservationId: reservation.id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } });
        for (const reservationRoom of reservation.reservationRooms) {
          if (!reservationRoom.roomId) continue;
          const otherActive = await tx.reservationRoom.findFirst({
            where: {
              roomId: reservationRoom.roomId,
              status: 'ACTIVE',
              reservationId: { not: reservation.id },
              checkIn: { lt: reservationRoom.checkOut },
              checkOut: { gt: reservationRoom.checkIn },
            },
          });
          if (!otherActive) await tx.room.update({ where: { id: reservationRoom.roomId }, data: { status: 'AVAILABLE' } });
        }

        await tx.auditLog.create({
          data: {
            organizationId: hold.organizationId,
            propertyId: hold.propertyId,
            userId: actorId,
            userEmail: 'booking.system@lodgecore.internal',
            userRole: 'SYSTEM',
            action: 'PENDING_RESERVATION_EXPIRED',
            resource: 'Reservation',
            resourceId: reservation.id,
            newValue: { status: 'EXPIRED', holdId: hold.id, reason: 'PAYMENT_WINDOW_EXPIRED' },
            requestId: `expire-reservation:${reservation.id}`,
          },
        });
        return {
          kind: 'EXPIRED' as const,
          reservationId: reservation.id,
          confirmationNumber: reservation.confirmationNumber,
          email: reservation.primaryGuest.email,
          propertyName: reservation.property.name,
        };
      }, { isolationLevel: 'Serializable' });

      if (result.kind === 'EXPIRED') {
        expired.push({ holdId: hold.id, reservationId: result.reservationId, confirmationNumber: result.confirmationNumber });
        if (result.email) {
          sendBookingExpiredEmail({ to: result.email, propertyName: result.propertyName, confirmationNumber: result.confirmationNumber }).catch((error) => console.error('[Booking Hold Expiry] email failed', error));
        }
        NotificationEngine.emit({ type: 'RESERVATION_EXPIRED', organizationId: hold.organizationId, propertyId: hold.propertyId, entityType: 'reservation', entityId: result.reservationId, idempotencyKey: `expired-reservation:${result.reservationId}`, metadata: { notificationType: 'RESERVATION_EXPIRED', source: 'BOOKING_HOLD_EXPIRY', reason: 'PAYMENT_WINDOW_EXPIRED' } }).catch((error: any) => console.error('[Booking Hold Expiry] notification failed', error));
      } else if (result.kind === 'PAID_PENDING') {
        paidPending.push(result.reservationId);
      }
    } catch (error) {
      console.error(`[Cron: expire-booking-holds] ${hold.id}`, error);
    }
  }

  // Corporate prepaid and pay-later reservations do not have BookingHold rows.
  // Both use the same reservation/room lifecycle with an explicit payment or
  // approval deadline.
  const corporatePending = await prisma.reservation.findMany({
    where: { source: 'CORPORATE', status: 'PENDING', paymentExpiresAt: { lt: now } },
    select: { id: true, propertyId: true, confirmationNumber: true, property: { select: { organizationId: true } }, corporatePaymentGroupReservations: { select: { groupId: true } }, reservationRooms: { select: { roomId: true, checkIn: true, checkOut: true } } },
    orderBy: { paymentExpiresAt: 'asc' },
    take: 100,
  });
  const processedCorporatePaymentGroups = new Set<string>();
  for (const reservation of corporatePending) {
    try {
      const paymentGroupId = reservation.corporatePaymentGroupReservations[0]?.groupId;
      if (paymentGroupId && processedCorporatePaymentGroups.has(paymentGroupId)) continue;
      if (paymentGroupId) processedCorporatePaymentGroups.add(paymentGroupId);
      const actorId = await getOrCreateBookingSystemActor(prisma as any, reservation.property.organizationId);
      await prisma.$transaction(async (tx: any) => {
        if (paymentGroupId) {
          await tx.$queryRaw`SELECT id FROM "CorporatePaymentGroup" WHERE id = ${paymentGroupId}::uuid FOR UPDATE`;
          const group = await tx.corporatePaymentGroup.findUnique({
            where: { id: paymentGroupId },
            include: { reservations: { include: { reservation: { select: { id: true, propertyId: true, confirmationNumber: true, status: true, paymentExpiresAt: true, ratePlanSnapshot: true, property: { select: { organizationId: true } }, reservationRooms: { select: { roomId: true, checkIn: true, checkOut: true } } } } } } },
          });
          if (!group) return;
          const pendingReservations = group.reservations.map((link: any) => link.reservation).filter((item: any) => item.status === 'PENDING' && item.paymentExpiresAt && item.paymentExpiresAt < now);
          if (pendingReservations.length === 0) return;
          await tx.reservation.updateMany({ where: { id: { in: pendingReservations.map((item: any) => item.id) }, status: 'PENDING', paymentExpiresAt: { lt: now } }, data: { status: 'EXPIRED', cancellationReason: 'Corporate prepaid payment group expired.' } });
          for (const pendingReservation of pendingReservations) {
            await tx.reservationRoom.updateMany({ where: { reservationId: pendingReservation.id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } });
            for (const room of pendingReservation.reservationRooms) {
              if (!room.roomId) continue;
              const otherActive = await tx.reservationRoom.findFirst({ where: { roomId: room.roomId, status: 'ACTIVE', reservationId: { not: pendingReservation.id }, checkIn: { lt: room.checkOut }, checkOut: { gt: room.checkIn } } });
              if (!otherActive) await tx.room.update({ where: { id: room.roomId }, data: { status: 'AVAILABLE' } });
            }
            const paymentMode = String((pendingReservation.ratePlanSnapshot as any)?.paymentMode || (pendingReservation.ratePlanSnapshot as any)?.request?.paymentMode || '').toUpperCase();
            const reason = paymentMode === 'PAY_LATER' ? 'APPROVAL_WINDOW_EXPIRED' : 'PAYMENT_WINDOW_EXPIRED';
            await tx.approvalRequest.updateMany({ where: { propertyId: pendingReservation.propertyId, type: 'CORPORATE_CREDIT', status: 'PENDING', details: { path: ['reservationId'], equals: pendingReservation.id } }, data: { status: 'EXPIRED', executionStatus: 'FAILED' } });
            await tx.auditLog.create({ data: { organizationId: pendingReservation.property.organizationId, propertyId: pendingReservation.propertyId, userId: actorId, userEmail: 'booking.system@lodgecore.internal', userRole: 'SYSTEM', action: 'CORPORATE_RESERVATION_EXPIRED', resource: 'Reservation', resourceId: pendingReservation.id, newValue: { status: 'EXPIRED', reason, paymentGroupId }, requestId: `expire-corporate-payment:${pendingReservation.id}` } });
            await tx.outboxEvent.create({ data: { organizationId: pendingReservation.property.organizationId, propertyId: pendingReservation.propertyId, eventType: 'CORPORATE_RESERVATION_EXPIRED', aggregateType: 'RESERVATION', aggregateId: pendingReservation.id, payload: { reservationId: pendingReservation.id, confirmationNumber: pendingReservation.confirmationNumber, reason, paymentGroupId } } });
          }
          await tx.corporatePaymentGroup.update({ where: { id: paymentGroupId }, data: { status: 'EXPIRED' } });
          return;
        }
        const expired = await tx.reservation.updateMany({ where: { id: reservation.id, status: 'PENDING', paymentExpiresAt: { lt: now } }, data: { status: 'EXPIRED', cancellationReason: 'Corporate prepaid payment window expired.' } });
        if (expired.count !== 1) return;
        await tx.reservationRoom.updateMany({ where: { reservationId: reservation.id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } });
        for (const room of reservation.reservationRooms) {
          if (!room.roomId) continue;
          const otherActive = await tx.reservationRoom.findFirst({ where: { roomId: room.roomId, status: 'ACTIVE', reservationId: { not: reservation.id }, checkIn: { lt: room.checkOut }, checkOut: { gt: room.checkIn } } });
          if (!otherActive) await tx.room.update({ where: { id: room.roomId }, data: { status: 'AVAILABLE' } });
        }
        const snapshot = (await tx.reservation.findUnique({ where: { id: reservation.id }, select: { ratePlanSnapshot: true } }))?.ratePlanSnapshot as any;
        const reason = String(snapshot?.paymentMode || snapshot?.request?.paymentMode || '').toUpperCase() === 'PAY_LATER'
          ? 'APPROVAL_WINDOW_EXPIRED'
          : 'PAYMENT_WINDOW_EXPIRED';
        await tx.approvalRequest.updateMany({ where: { propertyId: reservation.propertyId, type: 'CORPORATE_CREDIT', status: 'PENDING', details: { path: ['reservationId'], equals: reservation.id } }, data: { status: 'EXPIRED', executionStatus: 'FAILED' } });
        await tx.auditLog.create({ data: { organizationId: reservation.property.organizationId, propertyId: reservation.propertyId, userId: actorId, userEmail: 'booking.system@lodgecore.internal', userRole: 'SYSTEM', action: 'CORPORATE_RESERVATION_EXPIRED', resource: 'Reservation', resourceId: reservation.id, newValue: { status: 'EXPIRED', reason }, requestId: `expire-corporate-payment:${reservation.id}` } });
        await tx.outboxEvent.create({ data: { organizationId: reservation.property.organizationId, propertyId: reservation.propertyId, eventType: 'CORPORATE_RESERVATION_EXPIRED', aggregateType: 'RESERVATION', aggregateId: reservation.id, payload: { reservationId: reservation.id, confirmationNumber: reservation.confirmationNumber, reason } } });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      console.error(`[Cron: expire-corporate-payments] ${reservation.id}`, error);
    }
  }

  // Applications are temporary identities, not PMS accounts. Once their
  // approval/payment window has elapsed, expire the application and any still
  // active quote. A converted application is never touched here.
  const expiredApplications = await prisma.corporateBookingApplication.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    select: { id: true, organizationId: true, propertyId: true },
    take: 100,
  });
  for (const application of expiredApplications) {
    try {
      await prisma.$transaction(async (tx: any) => {
        await tx.$queryRaw`SELECT id FROM "CorporateBookingApplication" WHERE id = ${application.id}::uuid FOR UPDATE`;
        const pendingReservations = await tx.reservation.count({ where: { corporateBookingApplicationId: application.id, status: 'PENDING' } });
        if (pendingReservations > 0) return;
        const changed = await tx.corporateBookingApplication.updateMany({ where: { id: application.id, status: 'PENDING', expiresAt: { lt: now } }, data: { status: 'EXPIRED' } });
        if (changed.count !== 1) return;
        await tx.bookingQuote.updateMany({ where: { corporateBookingApplicationId: application.id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
        await tx.auditLog.create({ data: { organizationId: application.organizationId, propertyId: application.propertyId, userId: null, userEmail: 'booking.system@lodgecore.internal', userRole: 'SYSTEM', action: 'CORPORATE_APPLICATION_EXPIRED', resource: 'CorporateBookingApplication', resourceId: application.id, newValue: { status: 'EXPIRED', reason: 'APPLICATION_WINDOW_EXPIRED' }, requestId: `expire-corporate-application:${application.id}` } });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      console.error(`[Cron: expire-corporate-applications] ${application.id}`, error);
    }
  }

  return NextResponse.json({ success: true, checked: holds.length, expired: expired.length, paidPending: paidPending.length, corporateChecked: corporatePending.length, expiredReservations: expired, expiredApplications: expiredApplications.length, runAt: now.toISOString() });
}

export async function GET(req: NextRequest) { return expire(req); }
export async function POST(req: NextRequest) { return expire(req); }
