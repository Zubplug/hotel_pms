import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../website/src/lib/booking-engine/availability-service', () => ({
  AuthoritativeAvailabilityService: {
    assertAvailable: vi.fn().mockResolvedValue({ isAvailable: true }),
    findAssignableRoom: vi.fn().mockResolvedValue({ id: 'room-1', number: '101', roomTypeId: 'room-type-1' }),
  },
}));

vi.mock('../../../../website/src/lib/booking-engine/corporate-quote-service', () => ({
  CorporateQuoteError: class CorporateQuoteError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
  revalidateCorporateQuote: vi.fn().mockResolvedValue({
    current: {
      version: 1,
      request: { propertyId: 'property-1', roomTypeId: 'room-type-1', checkIn: '2026-11-10', checkOut: '2026-11-12', adults: 1, children: 0, paymentMode: 'FULL' },
      principalId: 'principal-acme',
      corporateAccount: { id: 'account-acme', code: 'ACME', name: 'Acme Corporation' },
      rateDecision: { kind: 'CORPORATE_ACCOUNT_RATE_PLAN', ratePlanId: 'rate-1', ratePlanCode: 'CORP-ACME', ratePlanName: 'Acme rate', priority: 100 },
      pricing: {}, taxes: [], fees: [], inclusions: [], cancellationPolicy: null,
      totals: { subtotal: 90000, taxes: 6750, fees: 0, total: 96750, currency: 'NGN' },
    },
  }),
}));

vi.mock('../../../../website/src/lib/services/reservation-service', () => ({
  SharedReservationService: {
    createReservation: vi.fn().mockResolvedValue({ id: 'reservation-1', confirmationNumber: 'RES-000001' }),
  },
}));

import { createCorporateReservation } from '../../../../website/src/lib/booking-engine/corporate-booking-service';

const principal = { id: 'principal-acme', organizationId: 'org-1', propertyIds: ['property-1'], corporateAccountId: 'account-acme' } as const;
const input = { quoteId: 'quote-1', idempotencyKey: 'request-1234', guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' } } as const;

function fixture() {
  const state: { request: any; quoteStatus: string; reservation: boolean } = { request: null, quoteStatus: 'ACTIVE', reservation: false };
  const tx = {
    bookingRequest: {
      findUnique: vi.fn().mockImplementation(async () => state.request),
      create: vi.fn().mockImplementation(async ({ data }: any) => { state.request = { ...data }; return state.request; }),
      update: vi.fn().mockImplementation(async ({ data }: any) => { state.request = { ...state.request, ...data }; return state.request; }),
    },
    bookingQuote: {
      findFirst: vi.fn().mockResolvedValue({ propertyId: 'property-1' }),
      updateMany: vi.fn().mockImplementation(async () => { if (state.quoteStatus !== 'ACTIVE') return { count: 0 }; state.quoteStatus = 'CONSUMED'; return { count: 1 }; }),
      update: vi.fn().mockResolvedValue({}),
    },
    reservation: { update: vi.fn().mockResolvedValue({ id: 'reservation-1', confirmationNumber: 'RES-000001', status: 'PENDING' }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    outboxEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = { $transaction: vi.fn(async (callback: (value: any) => Promise<unknown>) => {
    const before = { request: state.request, quoteStatus: state.quoteStatus };
    try {
      return await callback(tx);
    } catch (error) {
      state.request = before.request;
      state.quoteStatus = before.quoteStatus;
      throw error;
    }
  }) };
  return { db, tx, state };
}

describe('corporate booking transaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a pending prepaid PMS reservation and writes consumption/audit/outbox state', async () => {
    const { db, tx, state } = fixture();
    const result = await createCorporateReservation(db, principal, input, new Date('2026-10-24T00:00:00.000Z'));
    expect(result).toMatchObject({ reservationId: 'reservation-1', status: 'PENDING', paymentRequired: true, idempotent: false });
    expect(state.quoteStatus).toBe('CONSUMED');
    expect(tx.bookingRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', reservationId: 'reservation-1' }) }));
    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'CORPORATE_RESERVATION_CREATED', aggregateId: 'reservation-1' }) }));
  });

  it('replays the completed result for the same principal and idempotency fingerprint', async () => {
    const { db, state } = fixture();
    const first = await createCorporateReservation(db, principal, input);
    expect(first.idempotent).toBe(false);
    const replay = await createCorporateReservation(db, principal, input);
    expect(replay).toMatchObject({ reservationId: 'reservation-1', idempotent: true });
  });

  it('rejects a changed payload under the same idempotency key', async () => {
    const { db, state } = fixture();
    await createCorporateReservation(db, principal, input);
    await expect(createCorporateReservation(db, principal, { ...input, guest: { ...input.guest, lastName: 'Byron' } }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('cannot consume the same quote through a second booking operation', async () => {
    const { db, state } = fixture();
    await createCorporateReservation(db, principal, input);
    // Simulate a different idempotency key; the quote claim, not the request
    // key, is the invariant that prevents a second reservation.
    state.request = null;
    await expect(createCorporateReservation(db, principal, { ...input, idempotencyKey: 'request-5678' }))
      .rejects.toMatchObject({ code: 'QUOTE_CONSUMED' });
  });

  it('does not confirm prepaid bookings when reservation creation fails', async () => {
    const { db, state } = fixture();
    const reservationService = await import('../../../../website/src/lib/services/reservation-service');
    vi.mocked(reservationService.SharedReservationService.createReservation).mockRejectedValueOnce(new Error('reservation failed'));
    await expect(createCorporateReservation(db, principal, input)).rejects.toThrow('reservation failed');
    expect(state.quoteStatus).toBe('ACTIVE');
    expect(state.request).toBeNull();
  });
});
