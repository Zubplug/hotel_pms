import { describe, expect, it } from 'vitest';
import { signedRevenueAmount } from './kpi';

describe('signedRevenueAmount', () => {
  it('keeps charges positive', () => {
    expect(signedRevenueAmount('CHARGE', 100)).toBe(100);
  });

  it('treats production negative discounts as contra-revenue', () => {
    expect(signedRevenueAmount('DISCOUNT', -25)).toBe(-25);
  });

  it('normalizes legacy positive discounts as contra-revenue', () => {
    expect(signedRevenueAmount('DISCOUNT', 25)).toBe(-25);
  });
});
