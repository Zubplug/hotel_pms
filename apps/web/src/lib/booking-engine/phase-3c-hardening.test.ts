import { describe, expect, it } from 'vitest';
import { hasEntitlement } from '../../../../../packages/db/src/billing';
import { BookingPolicyError, validateBookingPolicy } from '../../../../website/src/lib/booking-engine/booking-policy-service';

const config = { minStay: 2, maxStay: 5, bookingLeadTimeHours: 24, maxAdvanceDays: 90 };
const now = new Date('2026-10-24T00:00:00.000Z');

describe('Phase 3C shared rules', () => {
  it('applies the same stay, lead-time, and advance-window policy contract', () => {
    expect(validateBookingPolicy({ checkIn: new Date('2026-11-01T00:00:00.000Z'), checkOut: new Date('2026-11-03T00:00:00.000Z') }, config, now)).toBe(2);
    expect(() => validateBookingPolicy({ checkIn: new Date('2026-10-24T12:00:00.000Z'), checkOut: new Date('2026-10-26T00:00:00.000Z') }, config, now)).toThrowError(BookingPolicyError);
    expect(() => validateBookingPolicy({ checkIn: new Date('2026-11-01T00:00:00.000Z'), checkOut: new Date('2026-11-02T00:00:00.000Z') }, config, now)).toThrowError('Minimum stay');
  });

  it('enforces entitlement start and expiry dates centrally', async () => {
    const db = { entitlement: { findFirst: async ({ where }: any) => {
      expect(where.AND).toEqual(expect.arrayContaining([
        { startsAt: { lte: now } },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ]));
      return null;
    } } };
    expect(await hasEntitlement(db as any, { organizationId: 'org-1', productCode: 'ADDON_CUSTOM_WEBSITE_API', propertyId: 'property-1', now })).toBe(false);
  });
});
