/**
 * Shared room-rate accounting contract.
 *
 * Corporate API pricing and PMS Night Audit must use the same decomposition:
 * gross rate = accommodation + VAT + service charge + food allocation.
 * The gross rate remains the commercial rate supplied by the rate plan or
 * corporate contract; the components are accounting classifications, not
 * extra amounts added to the guest price.
 */

export type CanonicalRoomRateBreakdownConfig = {
  enabled: boolean;
  complimentaryAllocationName: string;
  complimentaryFoodAmount: number;
  vatRate: number;
  serviceChargeRate: number;
  allowComplimentaryFoodOnDiscountedRooms: boolean;
  roomTypeOverrides?: Record<string, {
    complimentaryFoodAmount?: number;
    vatRate?: number;
    serviceChargeRate?: number;
  }>;
};

export type CanonicalRoomRateBreakdown = {
  grossRate: number;
  netAccommodation: number;
  vatAmount: number;
  serviceChargeAmount: number;
  complimentaryFoodAmount: number;
  complimentaryAllocationName: string;
  foodAllocationSuppressed: boolean;
  suppressionReason: string | null;
  componentTotal: number;
};

export const DEFAULT_CANONICAL_ROOM_RATE_BREAKDOWN_CONFIG: CanonicalRoomRateBreakdownConfig = {
  enabled: true,
  complimentaryAllocationName: 'Complimentary Breakfast Allocation',
  complimentaryFoodAmount: 3000,
  vatRate: 0.075,
  serviceChargeRate: 0.10,
  allowComplimentaryFoodOnDiscountedRooms: false,
  roomTypeOverrides: {},
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function computeCanonicalRoomRateBreakdown(input: {
  grossRate: number;
  config: CanonicalRoomRateBreakdownConfig;
  roomTypeName?: string;
  hasApprovedDiscount?: boolean;
  corporateFoodAllocationOverride?: boolean | null;
}): CanonicalRoomRateBreakdown {
  const grossRate = Math.max(0, Number(input.grossRate || 0));
  const config = input.config;
  if (!config.enabled || grossRate <= 0) {
    return {
      grossRate,
      netAccommodation: grossRate,
      vatAmount: 0,
      serviceChargeAmount: 0,
      complimentaryFoodAmount: 0,
      complimentaryAllocationName: config.complimentaryAllocationName,
      foodAllocationSuppressed: false,
      suppressionReason: null,
      componentTotal: grossRate,
    };
  }

  const override = input.roomTypeName
    ? config.roomTypeOverrides?.[input.roomTypeName.toUpperCase()]
    : undefined;
  const vatRate = override?.vatRate ?? config.vatRate;
  const serviceChargeRate = override?.serviceChargeRate ?? config.serviceChargeRate;
  const foodAmount = override?.complimentaryFoodAmount ?? config.complimentaryFoodAmount;

  let foodAllocationSuppressed = false;
  let suppressionReason: string | null = null;
  if (typeof input.corporateFoodAllocationOverride === 'boolean') {
    foodAllocationSuppressed = !input.corporateFoodAllocationOverride;
    suppressionReason = foodAllocationSuppressed
      ? 'Corporate rate agreement excludes complimentary food allocation'
      : null;
  } else if (input.hasApprovedDiscount && !config.allowComplimentaryFoodOnDiscountedRooms) {
    foodAllocationSuppressed = true;
    suppressionReason = 'Approved room discount active';
  }

  const food = foodAllocationSuppressed ? 0 : Math.max(0, foodAmount);
  const net = Math.max(0, grossRate - food) / (1 + vatRate + serviceChargeRate);
  const vat = net * vatRate;
  const serviceCharge = net * serviceChargeRate;
  const roundedVat = round2(vat);
  const roundedServiceCharge = round2(serviceCharge);
  const roundedFood = round2(food);
  const roundedNet = round2(net);
  const delta = round2(grossRate - (roundedNet + roundedVat + roundedServiceCharge + roundedFood));
  const finalNet = round2(roundedNet + delta);

  return {
    grossRate,
    netAccommodation: finalNet,
    vatAmount: roundedVat,
    serviceChargeAmount: roundedServiceCharge,
    complimentaryFoodAmount: roundedFood,
    complimentaryAllocationName: config.complimentaryAllocationName,
    foodAllocationSuppressed,
    suppressionReason,
    componentTotal: round2(finalNet + roundedVat + roundedServiceCharge + roundedFood),
  };
}
