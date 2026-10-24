import { findCorporateReservation } from './corporate-cancellation-service';

export class CorporateGuestError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'GUEST_EDIT_LOCKED' | 'INVALID_GUEST', message: string) {
    super(message);
  }
}

export type CorporateGuestDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
};

/**
 * Replaces the temporary corporate placeholder on the reservation. The same
 * Guest row is updated so folios, check-in and Front Desk workflows keep one
 * identity throughout the reservation lifecycle.
 */
export async function updateCorporateReservationGuest(
  db: any,
  principal: { organizationId: string; partnerId: string; propertyIds: readonly string[]; corporateAccountId?: string; corporateApplicationId?: string },
  reservationId: string,
  details: CorporateGuestDetails,
  requestId: string,
) {
  const reservation = await findCorporateReservation(db, principal, reservationId);
  if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
    throw new CorporateGuestError('GUEST_EDIT_LOCKED', 'Guest details cannot be changed after the reservation enters Front Desk processing');
  }

  const previous = reservation.primaryGuest;
  return db.$transaction(async (tx: any) => {
    const current = await tx.reservation.findFirst({
      where: { id: reservation.id, source: 'CORPORATE', propertyId: { in: [...principal.propertyIds] }, property: { organizationId: principal.organizationId }, status: { in: ['PENDING', 'CONFIRMED'] } },
      select: { id: true, propertyId: true, primaryGuestId: true, status: true },
    });
    if (!current) throw new CorporateGuestError('GUEST_EDIT_LOCKED', 'Guest details can no longer be changed for this reservation');

    const guest = await tx.guest.update({
      where: { id: current.primaryGuestId },
      data: { firstName: details.firstName, lastName: details.lastName, email: details.email, phone: details.phone || null, country: details.country || null },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, country: true },
    });
    await tx.auditLog.create({
      data: {
        organizationId: principal.organizationId,
        propertyId: current.propertyId,
        userId: null,
        userEmail: details.email,
        userRole: 'CORPORATE_API',
        action: 'CORPORATE_RESERVATION_GUEST_UPDATED',
        resource: 'Reservation',
        resourceId: current.id,
        previousValue: previous,
        newValue: { guestId: guest.id, ...guest },
        ipAddress: 'corporate-api',
        userAgent: 'LodgeCore Corporate API',
        requestId,
      },
    });
    return { reservationId: current.id, guest };
  });
}
