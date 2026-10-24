import { describe, expect, it } from 'vitest';
import { calculateCorporateNightlyRate } from '../../../../website/src/lib/booking-engine/corporate-rate-calculator';

describe('corporate rate factors', () => {
  it('applies stay-length, room-count, and payment-mode factors', () => {
    expect(calculateCorporateNightlyRate({
      baseNightlyAmount: 50000,
      nights: 7,
      roomCount: 2,
      paymentMode: 'FULL',
      factors: {
        stayLength: [{ minNights: 7, adjustmentType: 'PERCENT_DISCOUNT', value: 10 }],
        roomCount: [{ minRooms: 2, adjustmentType: 'PERCENT_DISCOUNT', value: 5 }],
        paymentMode: { FULL: { adjustmentType: 'FIXED_NIGHTLY_ADJUSTMENT', value: -1000 } },
      },
    })).toBe(41750);
  });

  it('does not use a PMS or room base rate as a factor input', () => {
    expect(calculateCorporateNightlyRate({ baseNightlyAmount: 35000, nights: 2, paymentMode: 'PAY_LATER' })).toBe(35000);
  });
});
