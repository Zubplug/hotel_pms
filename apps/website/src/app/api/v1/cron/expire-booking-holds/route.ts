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
        NotificationEngine.emit({ type: 'RESERVATION_CANCELLED', organizationId: hold.organizationId, propertyId: hold.propertyId, entityType: 'reservation', entityId: result.reservationId, idempotencyKey: `expired-reservation:${result.reservationId}`, metadata: { source: 'BOOKING_HOLD_EXPIRY', reason: 'PAYMENT_WINDOW_EXPIRED' } }).catch((error: any) => console.error('[Booking Hold Expiry] notification failed', error));
      } else if (result.kind === 'PAID_PENDING') {
        paidPending.push(result.reservationId);
      }
    } catch (error) {
      console.error(`[Cron: expire-booking-holds] ${hold.id}`, error);
    }
  }

  return NextResponse.json({ success: true, checked: holds.length, expired: expired.length, paidPending: paidPending.length, expiredReservations: expired, runAt: now.toISOString() });
}

export async function GET(req: NextRequest) { return expire(req); }
export async function POST(req: NextRequest) { return expire(req); }
