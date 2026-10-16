import { describe, expect, it } from 'vitest';
import { calculateReachAmounts, calculateReachReversal } from './reach-commission';

describe('Reach commission calculation', () => {
  it('uses only eligible collected revenue as the basis', () => {
    expect(calculateReachAmounts({
      eligibleRevenue: 100000,
      collectedRevenue: 80000,
      commissionBps: 700,
      platformFeeBps: 100,
    })).toEqual({ basis: 80000, commission: 5600, platformFee: 800 });
  });

  it('applies the property platform-fee cap', () => {
    expect(calculateReachAmounts({
      eligibleRevenue: 100000,
      collectedRevenue: 100000,
      commissionBps: 500,
      platformFeeBps: 200,
      platformFeeCap: 1000,
    })).toEqual({ basis: 100000, commission: 5000, platformFee: 1000 });
  });

  it('does not earn commission on an uncollected booking', () => {
    expect(calculateReachAmounts({
      eligibleRevenue: 100000,
      collectedRevenue: 0,
      commissionBps: 700,
      platformFeeBps: 100,
    })).toEqual({ basis: 0, commission: 0, platformFee: 0 });
  });

  it('caps partial refund reversals and never reverses twice', () => {
    expect(calculateReachReversal({
      originalBasis: 100000,
      refundedRevenue: 25000,
      commissionAmount: 7000,
      platformFeeAmount: 1000,
    })).toEqual({ refundBasis: 25000, commissionReversal: 1750, platformFeeReversal: 250 });

    expect(calculateReachReversal({
      originalBasis: 100000,
      refundedRevenue: 100000,
      commissionAmount: 7000,
      reversedCommissionAmount: 7000,
      platformFeeAmount: 1000,
      reversedPlatformFeeAmount: 1000,
    })).toEqual({ refundBasis: 100000, commissionReversal: 0, platformFeeReversal: 0 });
  });
});
