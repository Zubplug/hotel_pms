import { cancelReservationTransaction } from './reservation-cancellation-service';
import { calculateCancellationQuote } from './cancellation-service';

export class CorporateCancellationError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'NOT_CANCELLABLE' | 'ALREADY_CANCELLED', message: string) { super(message); }
}

export async function findCorporateReservation(db: any, principal: { organizationId: string; partnerId: string; propertyIds: readonly string[]; corporateAccountId?: string; corporateApplicationId?: string }, reservationId: string) {
  const reservation = await db.reservation.findFirst({
    where: { id: reservationId, source: 'CORPORATE', propertyId: { in: [...principal.propertyIds] }, property: { organizationId: principal.organizationId } },
    include: { primaryGuest: { select: { firstName: true, lastName: true, email: true } }, reservationRooms: true, cancellationPolicy: true, folios: { where: { type: 'ROOM', status: 'OPEN' }, take: 1, include: { payments: { include: { refunds: true } } } }, property: { select: { id: true, organizationId: true, businessDate: true, timezone: true, name: true } } },
  });
  const snapshotPrincipal = (reservation.ratePlanSnapshot as any)?.principalId;
  const ownedByAccount = principal.corporateAccountId && reservation.corporateAccountId === principal.corporateAccountId;
  const ownedByApplication = principal.corporateApplicationId && reservation.corporateBookingApplicationId === principal.corporateApplicationId;
  const ownedByPrincipal = !principal.corporateAccountId && !principal.corporateApplicationId && snapshotPrincipal === principal.partnerId;
  if (!reservation || !(ownedByAccount || ownedByApplication || ownedByPrincipal)) throw new CorporateCancellationError('NOT_FOUND', 'Reservation not found');
  return reservation;
}

export function corporateCancellationPreview(reservation: any, now = new Date()) {
  if (!['CONFIRMED', 'PENDING'].includes(reservation.status)) throw new CorporateCancellationError('NOT_CANCELLABLE', 'Reservation cannot be cancelled in its current state');
  return calculateCancellationQuote(reservation, now);
}

export async function cancelCorporateReservation(db: any, principal: { organizationId: string; partnerId: string; propertyIds: readonly string[] }, reservationId: string, reason?: string, now = new Date()) {
  const reservation = await findCorporateReservation(db, principal, reservationId);
  const result = await cancelReservationTransaction({ db, reservation, organizationId: principal.organizationId, propertyId: reservation.propertyId, channel: 'CORPORATE_API', reason, now, ipAddress: 'corporate-api' });
  return { reservationId: reservation.id, confirmationNumber: reservation.confirmationNumber, cancelled: true, ...result.quote, refundRequestsQueued: result.refundRequests.map((refund: any) => ({ id: refund.id, amount: Number(refund.requestedAmount), currency: refund.currency, status: refund.status })) };
}
