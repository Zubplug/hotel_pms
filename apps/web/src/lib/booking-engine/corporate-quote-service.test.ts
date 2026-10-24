import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../website/src/lib/booking-engine/availability-service', () => ({
  AuthoritativeAvailabilityService: {
    assertAvailable: vi.fn().mockResolvedValue({ isAvailable: true, availableRooms: 2 }),
  },
}));

vi.mock('../../../../website/src/lib/booking-engine/pricing-service', () => ({
  ReservationPricingService: {
    quote: vi.fn().mockResolvedValue({
      ratePlanId: 'corporate-rate-plan', roomTypeId: 'room-type-1', currency: 'NGN', nights: 2,
      nightlyRates: [
        { date: new Date('2026-11-10T00:00:00.000Z'), amount: 45000, source: 'RATE' },
        { date: new Date('2026-11-11T00:00:00.000Z'), amount: 45000, source: 'RATE' },
      ], subtotal: 90000, depositAmount: 0, depositType: null,
      snapshot: {
        ratePlanId: 'corporate-rate-plan', ratePlanCode: 'CORP-ACME', ratePlanName: 'Acme negotiated rate',
        roomTypeId: 'room-type-1', roomTypeName: 'Executive Room', currency: 'NGN', nights: 2,
        subtotal: 90000, depositAmount: 0, depositType: null, paymentMode: 'PAY_LATER',
        nightlyRates: [
          { date: new Date('2026-11-10T00:00:00.000Z'), amount: 45000, source: 'RATE' },
          { date: new Date('2026-11-11T00:00:00.000Z'), amount: 45000, source: 'RATE' },
        ], capturedAt: '2026-10-24T00:00:00.000Z',
      },
    }),
  },
}));

import {
  CorporateQuoteError,
  createCorporateQuote,
  getCorporateQuote,
  priceSnapshotFingerprint,
  requestFingerprint,
  type CorporatePrincipal,
} from '../../../../website/src/lib/booking-engine/corporate-quote-service';

const principal: CorporatePrincipal = { id: 'principal-acme', organizationId: 'org-1', propertyIds: ['property-1'], corporateAccountId: 'account-acme' };
const input = {
  propertyId: 'property-1', roomTypeId: 'room-type-1',
  checkIn: new Date('2026-11-10T00:00:00.000Z'), checkOut: new Date('2026-11-12T00:00:00.000Z'),
  adults: 1, children: 0,
} as const;

function txFixture() {
  return {
    corporateAccount: { findFirst: vi.fn().mockResolvedValue({
      id: 'account-acme', code: 'ACME', name: 'Acme Corporation', ratePlanId: 'corporate-rate-plan',
      ratePlan: { id: 'corporate-rate-plan', code: 'CORP-ACME', name: 'Acme negotiated rate', propertyId: 'property-1', isActive: true, deletedAt: null, includeFoodAllocation: true, cancellationPolicy: { id: 'cancel-1', type: 'FLEXIBLE' } },
    }) },
    corporateContract: { findMany: vi.fn().mockResolvedValue([{
      id: 'contract-1',
      versions: [{ id: 'version-1', version: 1, rules: [{
        id: 'rule-1', propertyId: 'property-1', roomTypeId: 'room-type-1', rateMethod: 'FIXED_NIGHTLY', amount: 45000,
        currency: 'NGN', priority: 100, minAdults: 1, maxAdults: null, minChildren: 0, maxChildren: null,
        minOccupancy: 1, maxOccupancy: 2, minStay: 1, maxStay: null, minLeadTimeHours: 0, maxAdvanceDays: null,
        minRooms: 1, maxRooms: null, pricingFactors: null, weekdays: [], blackoutDates: [], sourceRatePlanId: 'corporate-rate-plan',
      }] }],
    }]) },
    ratePlan: { findFirst: vi.fn().mockResolvedValue({
      id: 'corporate-rate-plan', code: 'CORP-ACME', name: 'Acme negotiated rate', propertyId: 'property-1',
      includeFoodAllocation: true, cancellationPolicy: { id: 'cancel-1', type: 'FLEXIBLE' }, rates: [{ currency: 'NGN' }],
    }) },
    roomType: { findFirst: vi.fn().mockResolvedValue({ id: 'room-type-1', maxOccupancy: 2 }) },
    tax: { findMany: vi.fn().mockResolvedValue([{ id: 'vat', name: 'VAT', code: 'VAT', type: 'PERCENTAGE', rate: 7.5, appliesTo: ['ROOM'], isInclusive: false }]) },
    bookingQuote: { create: vi.fn().mockResolvedValue({ id: 'quote-1' }), findFirst: vi.fn(), updateMany: vi.fn() },
  };
}

describe('corporate quote contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes equivalent requests to the same fingerprint', () => {
    expect(requestFingerprint(input)).toBe(requestFingerprint({ ...input, paymentMode: 'PAY_LATER' }));
  });

  it('creates a server-bound immutable snapshot with configured taxes and inclusions', async () => {
    const tx = txFixture();
    const result = await createCorporateQuote(tx, principal, input, new Date('2026-10-24T00:00:00.000Z'));
    expect(result.id).toBe('quote-1');
    expect(result.expiresAt.toISOString()).toBe('2026-10-24T00:05:00.000Z');
    expect(result.snapshot.principalId).toBe('principal-acme');
    expect(result.snapshot.corporateAccount.id).toBe('account-acme');
    expect(result.snapshot.rateDecision.kind).toBe('CORPORATE_CONTRACT_RULE');
    expect(result.snapshot.taxes[0].amount).toBe(6750);
    expect(result.snapshot.totals.total).toBe(96750);
    expect(result.snapshot.inclusions).toEqual(['FOOD_ALLOCATION']);
    expect(tx.bookingQuote.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-1', propertyId: 'property-1', principalId: 'principal-acme', corporateAccountId: 'account-acme', status: 'ACTIVE' }) }));
  });

  it('rejects a property outside the authenticated principal scope before database access', async () => {
    const tx = txFixture();
    await expect(createCorporateQuote(tx, principal, { ...input, propertyId: 'property-2' })).rejects.toMatchObject({ code: 'CORPORATE_SCOPE_DENIED' });
    expect(tx.corporateAccount.findFirst).not.toHaveBeenCalled();
  });

  it('distinguishes expired quotes from missing or non-active quotes', async () => {
    const tx = txFixture();
    tx.bookingQuote.findFirst.mockResolvedValue({ id: 'quote-1', organizationId: 'org-1', principalId: 'principal-acme', propertyId: 'property-1', status: 'ACTIVE', expiresAt: new Date('2026-10-23T00:00:00.000Z') });
    await expect(getCorporateQuote(tx, principal, 'quote-1', new Date('2026-10-24T00:00:00.000Z'))).rejects.toMatchObject({ code: 'QUOTE_EXPIRED' });
    expect(tx.bookingQuote.updateMany).toHaveBeenCalledWith({ where: { id: 'quote-1', status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
  });

  it('rejects a quote lookup when the principal is not the issuer', async () => {
    const tx = txFixture();
    tx.bookingQuote.findFirst.mockResolvedValue(null);
    await expect(getCorporateQuote(tx, { ...principal, id: 'other-principal' }, 'quote-1')).rejects.toBeInstanceOf(CorporateQuoteError);
    expect(tx.bookingQuote.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ principalId: 'other-principal' }) }));
  });

  it('changes the price fingerprint when the immutable rate snapshot changes', () => {
    const snapshot: any = { rateDecision: { ratePlanId: 'rate-1' }, pricing: { subtotal: 90000 }, taxes: [], fees: [], inclusions: [], cancellationPolicy: null, totals: { total: 90000 } };
    expect(priceSnapshotFingerprint(snapshot)).not.toBe(priceSnapshotFingerprint({ ...snapshot, totals: { total: 95000 } }));
  });
});
