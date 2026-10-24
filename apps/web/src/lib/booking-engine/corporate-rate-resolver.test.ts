import { describe, expect, it } from 'vitest';
import { CorporateRateResolutionError, isCorporateRateRuleEligible, selectCorporateRateRule } from '../../../../website/src/lib/booking-engine/corporate-rate-resolver';

const input = (overrides: Record<string, unknown> = {}) => ({
  propertyId: 'property-1',
  roomTypeId: 'room-1',
  checkIn: new Date('2026-11-10T00:00:00.000Z'),
  checkOut: new Date('2026-11-13T00:00:00.000Z'),
  adults: 2,
  children: 0,
  currency: 'NGN',
  now: new Date('2026-10-24T00:00:00.000Z'),
  ...overrides,
});

const rule = (overrides: Record<string, unknown> = {}) => ({
  id: 'rule-1', propertyId: 'property-1', roomTypeId: 'room-1', rateMethod: 'FIXED_NIGHTLY', amount: 25000,
  discountPercent: null, currency: 'NGN', priority: 100, minAdults: 1, maxAdults: null, minChildren: 0,
  maxChildren: null, minOccupancy: 1, maxOccupancy: null, minStay: 1, maxStay: null, minLeadTimeHours: 0,
  maxAdvanceDays: null, weekdays: [], blackoutDates: [], ...overrides,
});

describe('CorporateRateResolver', () => {
  it('matches occupancy and stay constraints', () => {
    expect(isCorporateRateRuleEligible(rule({ minOccupancy: 2, maxOccupancy: 3, minStay: 2, maxStay: 4 }), input())).toBe(true);
    expect(isCorporateRateRuleEligible(rule({ maxOccupancy: 1 }), input())).toBe(false);
    expect(isCorporateRateRuleEligible(rule({ minStay: 4 }), input())).toBe(false);
  });

  it('rejects a stay containing a blackout date', () => {
    expect(isCorporateRateRuleEligible(rule({ blackoutDates: [new Date('2026-11-11T00:00:00.000Z')] }), input())).toBe(false);
  });

  it('requires every night to satisfy weekday restrictions', () => {
    expect(isCorporateRateRuleEligible(rule({ weekdays: [2, 3] }), input())).toBe(false);
    expect(isCorporateRateRuleEligible(rule({ weekdays: [2, 3, 4] }), input())).toBe(true);
  });

  it('selects the highest-priority eligible rule', () => {
    const selected = selectCorporateRateRule([rule(), rule({ id: 'rule-2', priority: 200, amount: 24000 })], input());
    expect(selected.id).toBe('rule-2');
  });

  it('fails closed on conflicting equal-priority rules', () => {
    expect(() => selectCorporateRateRule([rule(), rule({ id: 'rule-2', amount: 24000 })], input()))
      .toThrowError(new CorporateRateResolutionError('CORPORATE_RATE_AMBIGUOUS', 'Multiple approved corporate rates with the same priority conflict'));
  });

  it('does not fall back to another currency or public/base rate', () => {
    expect(() => selectCorporateRateRule([rule({ currency: 'USD' })], input())).toThrowError('No approved corporate rate matches');
  });
});
