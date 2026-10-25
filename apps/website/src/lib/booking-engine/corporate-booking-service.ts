import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@hotel-pms/db';
import { AuthoritativeAvailabilityService } from './availability-service';
import { CorporateQuoteError, revalidateCorporateQuote, type CorporatePrincipal, type CorporateQuoteSnapshot } from './corporate-quote-service';
import { SharedReservationService } from '../services/reservation-service';
import { getOrCreateBookingSystemActor } from './system-actor';

type TxClient = Prisma.TransactionClient | PrismaClient | any;

export type CorporateGuestInput = Readonly<{
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
}>;

export type CorporateBookingInput = Readonly<{
  quoteId: string;
  idempotencyKey: string;
  /** Legacy single-guest shape retained for existing integrations. */
  guest?: CorporateGuestInput;
  /** One guest per reserved room. All reservations remain normal PMS reservations. */
  guests?: readonly CorporateGuestInput[];
  specialRequests?: string;
  externalReference?: string;
  deferGuestDetails?: boolean;
}>;

function normalizedGuests(input: CorporateBookingInput): readonly CorporateGuestInput[] {
  const guests = input.guests ?? (input.guest ? [input.guest] : []);
  if (input.deferGuestDetails && guests.length === 0) return [];
  if (guests.length < 1 || guests.length > 20) {
    throw new CorporateBookingError('BOOKING_INPUT_INVALID', 'Provide between 1 and 20 guests');
  }
  return guests;
}

export class CorporateBookingError extends Error {
  constructor(
    readonly code: 'IDEMPOTENCY_CONFLICT' | 'BOOKING_IN_PROGRESS' | 'QUOTE_CONSUMED' | 'BOOKING_INPUT_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'CorporateBookingError';
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

function scopedIdempotencyKey(principalId: string, clientKey: string): string {
  return crypto.createHash('sha256').update(`${principalId}|CORPORATE_BOOKING|${clientKey}`).digest('hex');
}

function bookingFingerprint(input: CorporateBookingInput): string {
  const guests = normalizedGuests(input);
  return crypto.createHash('sha256').update(canonical({
    quoteId: input.quoteId,
    guests,
    specialRequests: input.specialRequests ?? null,
    deferGuestDetails: input.deferGuestDetails ?? false,
    externalReference: input.externalReference ?? null,
  })).digest('hex');
}

function validateInput(input: CorporateBookingInput): void {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(input.idempotencyKey)) {
    throw new CorporateBookingError('BOOKING_INPUT_INVALID', 'Idempotency key must be 8–128 safe characters');
  }
  const guests = normalizedGuests(input);
  if (!input.quoteId || (!input.deferGuestDetails && guests.some((guest) => !guest.firstName.trim() || !guest.lastName.trim() || !/^\S+@\S+\.\S+$/.test(guest.email.trim())))) {
    throw new CorporateBookingError('BOOKING_INPUT_INVALID', 'Guest and quote details are invalid');
  }
  if (input.externalReference && input.externalReference.length > 128) {
    throw new CorporateBookingError('BOOKING_INPUT_INVALID', 'External reference is too long');
  }
}

function isPaymentRequired(snapshot: CorporateQuoteSnapshot): boolean {
  return ['FULL', 'DEPOSIT'].includes(snapshot.request.paymentMode.toUpperCase());
}

function reservationSnapshot(snapshot: CorporateQuoteSnapshot) {
  return {
    ...snapshot,
    // Preserve the root fields expected by existing reservation/payment/read
    // models while retaining the complete corporate quote contract below them.
    subtotal: snapshot.totals.subtotal,
    total: snapshot.totals.total,
    currency: snapshot.totals.currency,
    paymentMode: snapshot.request.paymentMode,
    depositAmount: snapshot.pricing.depositAmount,
  };
}

async function runBookingTransaction(
  db: TxClient,
  principal: CorporatePrincipal,
  input: CorporateBookingInput,
  now: Date,
) {
  const scopedKey = scopedIdempotencyKey(principal.id, input.idempotencyKey);
  const fingerprint = bookingFingerprint(input);
  return db.$transaction(async (tx: any) => {
    const existing = await tx.bookingRequest.findUnique({ where: { idempotencyKey: scopedKey } });
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new CorporateBookingError('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with a different request');
      }
      if (existing.status === 'COMPLETED' && (existing.reservationIds || existing.reservationId)) {
        const reservationIds = Array.isArray(existing.reservationIds)
          ? existing.reservationIds as string[]
          : [existing.reservationId];
        return { reservationId: reservationIds[0], reservationIds, status: 'COMPLETED', idempotent: true, paymentRequired: null };
      }
      throw new CorporateBookingError('BOOKING_IN_PROGRESS', 'A booking with this idempotency key is already being processed');
    }

      const quoteScope = await tx.bookingQuote.findFirst({
      where: {
        id: input.quoteId,
        organizationId: principal.organizationId,
        principalId: principal.id,
        corporateAccountId: principal.corporateAccountId,
        corporateBookingApplicationId: principal.corporateApplicationId,
        propertyId: { in: [...principal.propertyIds] },
      },
      select: { propertyId: true },
    });
    if (!quoteScope) throw new CorporateQuoteError('QUOTE_NOT_FOUND', 'Quote not found');

    await tx.bookingRequest.create({
      data: {
        idempotencyKey: scopedKey,
        propertyId: quoteScope.propertyId,
        principalId: principal.id,
        operation: 'CORPORATE_BOOKING_CREATE',
        requestFingerprint: fingerprint,
        status: 'PROCESSING',
      },
    });

    const validated = await revalidateCorporateQuote(tx, principal, input.quoteId, now);
    const snapshot = validated.current;
    const requestedGuests = normalizedGuests(input);
    const roomLines = snapshot.roomSelections?.length ? snapshot.roomSelections : [snapshot];
    const roomCount = roomLines.reduce((sum, line) => sum + (line.request.roomCount ?? 1), 0);
    if (requestedGuests.length > 0 && requestedGuests.length !== roomCount) {
      throw new CorporateBookingError('BOOKING_INPUT_INVALID', `This quote requires exactly ${roomCount} guest${roomCount === 1 ? '' : 's'}`);
    }
    const owner = input.deferGuestDetails && requestedGuests.length === 0
      ? principal.corporateAccountId
        ? await tx.corporateAccount.findUnique({ where: { id: principal.corporateAccountId }, select: { name: true, contactPerson: true, contactEmail: true, contactPhone: true } })
        : principal.corporateApplicationId
          ? await tx.corporateBookingApplication.findUnique({ where: { id: principal.corporateApplicationId }, select: { companyName: true, contactPerson: true, contactEmail: true, contactPhone: true } })
          : null
      : null;
    const guests = requestedGuests.length > 0 ? requestedGuests : Array.from({ length: roomCount }, () => ({
      firstName: owner?.contactPerson || ('companyName' in (owner || {}) ? owner?.companyName : undefined) || snapshot.corporateAccount.name,
      lastName: 'Corporate guest',
      email: owner?.contactEmail || `corporate-${principal.id}@lodgecore.invalid`,
      phone: owner?.contactPhone || undefined,
    }));
    const propertyId = snapshot.request.propertyId;

    const consumed = await tx.bookingQuote.updateMany({
      where: {
        id: input.quoteId,
        organizationId: principal.organizationId,
        principalId: principal.id,
        corporateAccountId: principal.corporateAccountId,
        propertyId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      data: { status: 'CONSUMED', consumedAt: now },
    });
    if (consumed.count !== 1) {
      throw new CorporateBookingError('QUOTE_CONSUMED', 'Quote was already consumed; use the original idempotency key to retrieve the booking');
    }

    for (const line of roomLines) {
      const availability = await AuthoritativeAvailabilityService.assertAvailable(tx, {
        propertyId,
        roomTypeId: line.request.roomTypeId,
        checkIn: new Date(`${line.request.checkIn}T00:00:00.000Z`),
        checkOut: new Date(`${line.request.checkOut}T00:00:00.000Z`),
      });
      if (availability.availableRooms < (line.request.roomCount ?? 1)) throw new CorporateQuoteError('QUOTE_PRICE_CHANGED', 'One of the requested room types is no longer available');
    }

    const paymentRequired = isPaymentRequired(snapshot);
    const payLater = snapshot.request.paymentMode.toUpperCase() === 'PAY_LATER';
    if (payLater && principal.corporateAccountId) {
      const accountId = principal.corporateAccountId;
      await tx.$queryRaw<any[]>`
        SELECT cla.id
        FROM "CityLedgerAccount" cla
        JOIN "CorporateAccount" ca ON ca."cityLedgerAccountId" = cla.id
        WHERE ca.id = ${accountId}::uuid
        FOR UPDATE
      `;
      const account = await tx.corporateAccount.findUnique({ where: { id: principal.corporateAccountId }, select: { cityLedgerAccountId: true, creditLimit: true, exemptFromHighBalance: true, cityLedgerAccount: { select: { status: true, balance: true } } } });
      if (!account?.cityLedgerAccountId || account.cityLedgerAccount?.status !== 'ACTIVE') {
        throw new CorporateBookingError('BOOKING_INPUT_INVALID', 'Corporate pay-later bookings require an active City Ledger account');
      }
      if (Number(account.creditLimit) > 0 && !account.exemptFromHighBalance && Number(account.cityLedgerAccount.balance) + snapshot.totals.total > Number(account.creditLimit)) {
        throw new CorporateBookingError('BOOKING_INPUT_INVALID', 'Corporate credit limit would be exceeded');
      }
    }
    const reservations: Array<{ id: string; confirmationNumber: string; status: string; amount: number }> = [];
    let reservationIndex = 0;
    for (const line of roomLines) {
      const lineRoomCount = line.request.roomCount ?? 1;
      const perReservationTotal = line.totals.total / lineRoomCount;
      for (let lineIndex = 0; lineIndex < lineRoomCount; lineIndex += 1) {
      const guest = guests[reservationIndex];
      const reservationGuest = input.deferGuestDetails && requestedGuests.length === 0
        ? { ...guest, firstName: `Corporate Guest ${reservationIndex + 1}`, lastName: 'Pending' }
        : guest;
      const assignedRoom = await AuthoritativeAvailabilityService.findAssignableRoom(tx, {
        propertyId,
        roomTypeId: line.request.roomTypeId,
        checkIn: new Date(`${line.request.checkIn}T00:00:00.000Z`),
        checkOut: new Date(`${line.request.checkOut}T00:00:00.000Z`),
      });
      if (!assignedRoom) throw new CorporateQuoteError('QUOTE_PRICE_CHANGED', 'A physical room is no longer available for one of the selected room types');
      const reservation = await SharedReservationService.createReservation({
      propertyId,
      organizationId: principal.organizationId,
      guestDetails: reservationGuest,
      checkIn: new Date(`${line.request.checkIn}T00:00:00.000Z`),
      checkOut: new Date(`${line.request.checkOut}T00:00:00.000Z`),
      roomTypeId: line.request.roomTypeId,
      // Corporate reservations follow the normal PMS allocation invariant:
      // reserve a physical room now; Front Desk only completes the guest
      // identity/check-in workflow later.
      roomId: assignedRoom.id,
      adults: line.request.adults,
      children: line.request.children,
      corporateAccountId: principal.corporateAccountId,
      corporateBookingApplicationId: principal.corporateApplicationId,
      ratePlanId: line.rateDecision.ratePlanId,
      overrideTotalAmount: perReservationTotal,
      currency: line.totals.currency,
      source: 'CORPORATE',
      status: paymentRequired || payLater ? 'PENDING' : 'CONFIRMED',
      specialRequests: input.specialRequests,
      createdByType: 'SYSTEM',
      userEmail: reservationGuest.email,
      userRole: 'CORPORATE_API',
      requestId: `${scopedKey}:${reservationIndex + 1}`,
      tx,
      });

      const updatedReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        ratePlanSnapshot: reservationSnapshot({
          ...line,
          pricing: { ...line.pricing, subtotal: line.pricing.subtotal / lineRoomCount, depositAmount: line.pricing.depositAmount / lineRoomCount },
          totals: { ...line.totals, subtotal: line.totals.subtotal / lineRoomCount, taxes: line.totals.taxes / lineRoomCount, total: perReservationTotal },
        }),
        bookingChannelRef: `${input.externalReference ?? `CORPORATE:${scopedKey}`}:${reservationIndex + 1}`,
        paymentExpiresAt: paymentRequired
          ? new Date(now.getTime() + 15 * 60 * 1000)
          : payLater
            ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
            : null,
      },
      select: { id: true, confirmationNumber: true, status: true, ratePlanSnapshot: true },
      });
      reservations.push({ ...updatedReservation, amount: perReservationTotal });
      reservationIndex += 1;
      }
    }
    const reservationIds = reservations.map((reservation) => reservation.id);
    await tx.bookingQuote.update({ where: { id: input.quoteId }, data: { reservationId: reservationIds[0] } });
    if (paymentRequired && roomCount > 1) {
      const requiredAmount = snapshot.request.paymentMode.toUpperCase() === 'DEPOSIT'
        ? snapshot.pricing.depositAmount
        : snapshot.totals.total;
      await tx.corporatePaymentGroup.create({
        data: {
          organizationId: principal.organizationId,
          propertyId,
          corporateAccountId: principal.corporateAccountId,
          corporateBookingApplicationId: principal.corporateApplicationId,
          requiredAmount,
          currency: snapshot.totals.currency,
          reservations: {
            create: reservations.map((reservation) => ({
              reservationId: reservation.id,
              amountRequired: requiredAmount / roomCount,
            })),
          },
        },
      });
    }
    if (payLater) {
      const actorId = await getOrCreateBookingSystemActor(tx, principal.organizationId);
      for (const reservation of reservations) await tx.approvalRequest.create({
        data: {
          propertyId,
          type: 'CORPORATE_CREDIT',
          status: 'PENDING',
          executionStatus: 'NOT_APPLIED',
          requestedBy: actorId,
          amount: reservation.amount,
          currency: snapshot.totals.currency,
          reason: 'Corporate pay-later reservation requires property management approval',
          details: { reservationId: reservation.id, corporateAccountId: principal.corporateAccountId, corporateBookingApplicationId: principal.corporateApplicationId, partnerId: principal.id, confirmationNumber: reservation.confirmationNumber },
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          idempotencyKey: `corporate-credit:${reservation.id}`,
        },
      });
    }
    await tx.bookingRequest.update({ where: { idempotencyKey: scopedKey }, data: { status: 'COMPLETED', reservationId: reservationIds[0], reservationIds } });
    for (const reservation of reservations) await tx.auditLog.create({
      data: {
        organizationId: principal.organizationId,
        propertyId,
        userId: null,
        userEmail: guests[0].email,
        userRole: 'CORPORATE_API',
        action: 'CORPORATE_QUOTE_CONSUMED',
        resource: 'BookingQuote',
        resourceId: input.quoteId,
        newValue: { reservationId: reservation.id, reservationIds, idempotencyKey: scopedKey, paymentRequired, total: snapshot.totals.total },
        ipAddress: 'corporate-api',
        userAgent: 'LodgeCore Corporate Booking Service',
        requestId: scopedKey,
      },
    });
    for (const reservation of reservations) await tx.outboxEvent.create({
      data: {
        organizationId: principal.organizationId,
        propertyId,
        eventType: 'CORPORATE_RESERVATION_CREATED',
        aggregateType: 'RESERVATION',
        aggregateId: reservation.id,
        payload: { reservationId: reservation.id, reservationIds, quoteId: input.quoteId, principalId: principal.id, idempotencyKey: scopedKey, status: reservation.status, paymentRequired },
      },
    });

    return { reservationId: reservationIds[0], reservationIds, confirmationNumber: reservations[0].confirmationNumber, status: reservations[0].status, paymentRequired, approvalRequired: payLater, idempotent: false };
  }, { isolationLevel: 'Serializable' });
}

export async function createCorporateReservation(
  db: TxClient,
  principal: CorporatePrincipal,
  input: CorporateBookingInput,
  now = new Date(),
) {
  validateInput(input);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await runBookingTransaction(db, principal, input, now);
    } catch (error: any) {
      // PostgreSQL serializable conflicts are expected when two callers race
      // for the same quote. The retry sees the committed idempotency result.
      if (error?.code === 'P2034' && attempt === 0) continue;
      throw error;
    }
  }
  throw new CorporateBookingError('BOOKING_IN_PROGRESS', 'Booking could not be completed after a concurrency retry');
}
