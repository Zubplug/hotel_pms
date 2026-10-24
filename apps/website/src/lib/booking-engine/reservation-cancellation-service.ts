import { getOrCreateBookingSystemActor } from './system-actor';
import { queueBookingRefundRequests } from './refund-service';
import { calculateCancellationQuote } from './cancellation-service';

export type CancellationChannel = 'PUBLIC_API' | 'CORPORATE_API';

export async function cancelReservationTransaction(input: {
  db: any;
  reservation: any;
  organizationId: string;
  propertyId: string;
  channel: CancellationChannel;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const quote = calculateCancellationQuote(input.reservation, now);
  const systemActorId = await getOrCreateBookingSystemActor(input.db, input.organizationId);
  const refundRequests = await input.db.$transaction(async (tx: any) => {
    const current = await tx.reservation.findUnique({ where: { id: input.reservation.id }, select: { status: true } });
    if (!current || !['CONFIRMED', 'PENDING'].includes(current.status)) {
      throw new Error('Reservation has already been cancelled or completed');
    }
    await tx.reservation.update({ where: { id: input.reservation.id }, data: { status: 'CANCELLED', cancelledAt: now, cancelledBy: systemActorId, cancellationReason: input.reason || `${input.channel === 'PUBLIC_API' ? 'Guest self-service' : 'Corporate API'} cancellation` } });

    if (quote.penaltyAmount > 0 && input.reservation.folios[0]) {
      const operationId = `BOOKING_CANCEL_PENALTY_${input.reservation.id}`;
      const existingPenalty = await tx.folioItem.findFirst({ where: { operationId } });
      if (!existingPenalty) {
        await tx.folioItem.create({ data: { folioId: input.reservation.folios[0].id, reservationId: input.reservation.id, guestId: input.reservation.primaryGuestId, businessDate: input.reservation.property.businessDate || now, type: 'CHARGE', source: 'ROOM_CHARGE', revenueCategory: 'ROOM', description: `Cancellation fee — ${quote.penaltyDescription}`, quantity: 1, unitAmount: quote.penaltyAmount, amount: quote.penaltyAmount, currency: input.reservation.currency, baseAmount: quote.penaltyAmount, postedBy: systemActorId, operationId } });
        await tx.folio.update({ where: { id: input.reservation.folios[0].id }, data: { totalCharges: { increment: quote.penaltyAmount }, balance: { increment: quote.penaltyAmount } } });
      }
    }

    await tx.reservationRoom.updateMany({ where: { reservationId: input.reservation.id }, data: { status: 'CANCELLED' } });
    for (const reservationRoom of input.reservation.reservationRooms) {
      if (!reservationRoom.roomId) continue;
      const otherActive = await tx.reservationRoom.findFirst({ where: { roomId: reservationRoom.roomId, status: 'ACTIVE', reservationId: { not: input.reservation.id }, checkIn: { lt: input.reservation.checkOut }, checkOut: { gt: input.reservation.checkIn } } });
      if (!otherActive) await tx.room.update({ where: { id: reservationRoom.roomId }, data: { status: 'AVAILABLE' } });
    }

    const refunds = await queueBookingRefundRequests({ tx, reservation: input.reservation, property: input.reservation.property, totalPaid: input.reservation.folios.reduce((sum: number, folio: any) => sum + folio.payments.reduce((inner: number, payment: any) => inner + Number(payment.amount), 0), 0), cancellationPenalty: quote.penaltyAmount, reason: `${input.reason || `${input.channel === 'PUBLIC_API' ? 'Guest self-service' : 'Corporate API'} cancellation`}${quote.penaltyAmount > 0 ? `; cancellation policy penalty applied: ${quote.penaltyAmount.toFixed(2)}` : ''}` });
    await tx.auditLog.create({ data: { organizationId: input.organizationId, propertyId: input.propertyId, userId: systemActorId, userEmail: 'booking.system@lodgecore.internal', userRole: input.channel === 'PUBLIC_API' ? 'GUEST' : 'CORPORATE_API', action: 'RESERVATION_CANCELLED', resource: 'Reservation', resourceId: input.reservation.id, newValue: { status: 'CANCELLED', cancelledVia: input.channel, penaltyAmount: quote.penaltyAmount, reason: input.reason || input.channel }, ipAddress: input.ipAddress || 'system', userAgent: input.userAgent || 'LodgeCore Booking API', requestId: input.requestId || `${input.channel}:${input.reservation.id}` } });
    await tx.outboxEvent.create({ data: { organizationId: input.organizationId, propertyId: input.propertyId, eventType: 'RESERVATION_CANCELLED', aggregateType: 'RESERVATION', aggregateId: input.reservation.id, payload: { reservationId: input.reservation.id, cancelledVia: input.channel, penaltyAmount: quote.penaltyAmount } } });
    return refunds;
  });
  return { quote, refundRequests };
}
