import { describe, it, expect } from 'vitest';
import { computeRateBreakdown } from '../room-rate-breakdown';

describe('Room Rate Breakdown Engine (Hotel Stanzel)', () => {
  it('correctly decomposes a standard room rate of ₦50,000 with ₦3,000 complimentary food allocation', () => {
    const result = computeRateBreakdown({
      grossRate: 50000,
      allowComplimentaryFoodOnDiscountedRooms: false,
      hasApprovedDiscount: false,
    });

    // Gross = 50,000
    // Complimentary Food (GL 4250) = 3,000
    // Gross room without food = 47,000
    // Divisor = 1 + 0.075 + 0.10 = 1.175
    // Net accommodation = 47,000 / 1.175 = 40,000
    // VAT (7.5%) = 40,000 * 0.075 = 3,000
    // Service Charge (10%) = 40,000 * 0.10 = 4,000
    // Total sum = 40,000 + 3,000 + 4,000 + 3,000 = 50,000 (reconciled exactly to gross)
    expect(result.grossRate).toBe(50000);
    expect(result.complimentaryFoodAllocation).toBe(3000);
    expect(result.netAccommodation).toBe(40000);
    expect(result.vat).toBe(3000);
    expect(result.serviceCharge).toBe(4000);
    expect(result.totalReconciled).toBe(50000);
    expect(result.isComplimentaryFoodAllocated).toBe(true);
    expect(result.suppressionReason).toBeNull();
  });

  it('suppresses complimentary food allocation when room has approved discount (default behavior)', () => {
    const result = computeRateBreakdown({
      grossRate: 40000,
      allowComplimentaryFoodOnDiscountedRooms: false,
      hasApprovedDiscount: true,
    });

    // Food allocation = 0
    // Net accommodation = 40,000 / 1.175 ≈ 34,042.55
    // VAT (7.5%) ≈ 2,553.19
    // Service Charge (10%) ≈ 3,404.26
    // Total sum = 40,000
    expect(result.complimentaryFoodAllocation).toBe(0);
    expect(result.isComplimentaryFoodAllocated).toBe(false);
    expect(result.suppressionReason).toBe('Approved room discount active');
    expect(result.totalReconciled).toBe(40000);
  });

  it('allows complimentary food allocation on discounted room when property setting is enabled', () => {
    const result = computeRateBreakdown({
      grossRate: 40000,
      allowComplimentaryFoodOnDiscountedRooms: true,
      hasApprovedDiscount: true,
    });

    expect(result.complimentaryFoodAllocation).toBe(3000);
    expect(result.isComplimentaryFoodAllocated).toBe(true);
    expect(result.suppressionReason).toBeNull();
    expect(result.totalReconciled).toBe(40000);
  });

  it('respects corporate agreement food allocation override (enabled)', () => {
    const result = computeRateBreakdown({
      grossRate: 45000,
      hasApprovedDiscount: true, // even if discounted
      corporateFoodAllocationOverride: true,
    });

    expect(result.complimentaryFoodAllocation).toBe(3000);
    expect(result.isComplimentaryFoodAllocated).toBe(true);
    expect(result.corporateOverrideApplied).toBe(true);
    expect(result.suppressionReason).toBeNull();
    expect(result.totalReconciled).toBe(45000);
  });

  it('respects corporate agreement food allocation override (disabled)', () => {
    const result = computeRateBreakdown({
      grossRate: 45000,
      hasApprovedDiscount: false, // standard corporate rate
      corporateFoodAllocationOverride: false,
    });

    expect(result.complimentaryFoodAllocation).toBe(0);
    expect(result.isComplimentaryFoodAllocated).toBe(false);
    expect(result.corporateOverrideApplied).toBe(true);
    expect(result.suppressionReason).toBe('Corporate rate agreement excludes complimentary food allocation');
    expect(result.totalReconciled).toBe(45000);
  });

  it('handles zero or negative gross rates gracefully', () => {
    const result = computeRateBreakdown({
      grossRate: 0,
    });

    expect(result.grossRate).toBe(0);
    expect(result.complimentaryFoodAllocation).toBe(0);
    expect(result.netAccommodation).toBe(0);
    expect(result.vat).toBe(0);
    expect(result.serviceCharge).toBe(0);
    expect(result.totalReconciled).toBe(0);
  });
});
