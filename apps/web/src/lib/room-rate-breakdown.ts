/**
 * Room Rate Breakdown Engine
 * ──────────────────────────
 * Implements the hotel's canonical rate-component model exactly as defined by
 * Hotel Stanzel's approved rate sheet:
 *
 *   Gross Rate = Net Accommodation + VAT (7.5%) + Service Charge (10%) + Complimentary Breakfast Allocation
 *
 * All four components are configured via the accountant's RoomRateBreakdown
 * settings stored in `property.settings.roomRateBreakdown`. Hard-coded
 * defaults match the approved hotel rate sheet.
 *
 * Complimentary Breakfast Allocation is F&B revenue (GL 4250), NOT room
 * revenue (GL 4050). This distinction is enforced both here and in the
 * Night Audit GL journal.
 *
 * OFFLINE ALIGNMENT:
 * The LocalRepository.cs offline night-audit path reads `RateBreakdownJson`
 * from the synced LocalProperty row and uses the same calculation so that
 * offline and cloud postings always produce identical component amounts.
 */

export interface RoomRateBreakdownConfig {
  /** Monotonically increasing policy version used by offline clients. */
  version: number;
  /** Whether to post itemised breakdown lines instead of a single gross line */
  enabled: boolean;
  /** Professional display name for the complimentary food component */
  complimentaryAllocationName: string;
  /** Fixed complimentary food amount per room-night (₦) */
  complimentaryFoodAmount: number;
  /** VAT rate as a fraction, e.g. 0.075 for 7.5% */
  vatRate: number;
  /** Service charge rate as a fraction, e.g. 0.10 for 10% */
  serviceChargeRate: number;
  /**
   * When true, rooms that received an approved discount ALSO receive the
   * complimentary breakfast allocation.
   * When false (default), discounted rooms forfeit the allocation.
   */
  allowComplimentaryFoodOnDiscountedRooms: boolean;
  /** GL account codes — must match the chart of accounts */
  glCodes: {
    netAccommodation: string; // 4050
    complimentaryBreakfast: string; // 4250
    vatPayable: string; // 2200
    serviceChargePayable: string; // 2210
  };
  /** Optional per-room-type overrides; key = room type name (upper) or ID */
  roomTypeOverrides?: Record<
    string,
    { complimentaryFoodAmount?: number; vatRate?: number; serviceChargeRate?: number }
  >;
}

export const DEFAULT_BREAKDOWN_CONFIG: RoomRateBreakdownConfig = {
  version: 1,
  enabled: true,
  complimentaryAllocationName: 'Complimentary Breakfast Allocation',
  complimentaryFoodAmount: 3000,
  vatRate: 0.075,
  serviceChargeRate: 0.10,
  allowComplimentaryFoodOnDiscountedRooms: false,
  glCodes: {
    netAccommodation: '4050',
    complimentaryBreakfast: '4250',
    vatPayable: '2200',
    serviceChargePayable: '2210',
  },
};

export interface RateBreakdownResult {
  /** The original gross rate as charged on the folio */
  grossRate: number;
  /** Net accommodation revenue (GL 4050) */
  netAccommodation: number;
  /** VAT amount (GL 2200) */
  vatAmount: number;
  /** Service charge amount (GL 2210) */
  serviceChargeAmount: number;
  /**
   * Complimentary breakfast allocation (GL 4250).
   * Zero when food allocation is suppressed (due to discount or corporate contract).
   */
  complimentaryFoodAmount: number;
  /** Professional name for the food component as configured by accountant */
  complimentaryAllocationName: string;
  /** True when the food allocation was suppressed (due to discount or corporate contract) */
  foodAllocationSuppressed: boolean;
  /** Identifies whether an explicit corporate contract override was applied */
  corporateOverrideApplied: boolean;
  /** Detailed reason why food allocation was suppressed, if applicable */
  suppressionReason: string | null;
  /** Sum check: should equal grossRate (within rounding tolerance) */
  componentTotal: number;
  /** True when all components sum exactly to grossRate */
  balanced: boolean;

  // Ergonomic convenience aliases
  vat: number;
  serviceCharge: number;
  complimentaryFoodAllocation: number;
  isComplimentaryFoodAllocated: boolean;
  totalReconciled: number;
}

export interface ComputeRateBreakdownOptions {
  grossRate: number;
  config?: RoomRateBreakdownConfig;
  allowComplimentaryFoodOnDiscountedRooms?: boolean;
  hasApprovedDiscount?: boolean;
  roomTypeName?: string;
  corporateFoodAllocationOverride?: boolean | null;
}

/**
 * Reads the saved breakdown config from the raw property settings object,
 * merging with safe defaults so callers never have to handle nulls.
 */
export function resolveBreakdownConfig(
  propertySettings: Record<string, any> | null | undefined,
): RoomRateBreakdownConfig {
  const saved = propertySettings?.roomRateBreakdown as Partial<RoomRateBreakdownConfig> | undefined;
  if (!saved) return { ...DEFAULT_BREAKDOWN_CONFIG };
  return {
    version:
      typeof saved.version === 'number' && Number.isInteger(saved.version) && saved.version > 0
        ? saved.version
        : DEFAULT_BREAKDOWN_CONFIG.version,
    enabled: saved.enabled ?? DEFAULT_BREAKDOWN_CONFIG.enabled,
    complimentaryAllocationName:
      saved.complimentaryAllocationName?.trim() ||
      DEFAULT_BREAKDOWN_CONFIG.complimentaryAllocationName,
    complimentaryFoodAmount:
      typeof saved.complimentaryFoodAmount === 'number'
        ? saved.complimentaryFoodAmount
        : DEFAULT_BREAKDOWN_CONFIG.complimentaryFoodAmount,
    vatRate:
      typeof saved.vatRate === 'number' ? saved.vatRate : DEFAULT_BREAKDOWN_CONFIG.vatRate,
    serviceChargeRate:
      typeof saved.serviceChargeRate === 'number'
        ? saved.serviceChargeRate
        : DEFAULT_BREAKDOWN_CONFIG.serviceChargeRate,
    allowComplimentaryFoodOnDiscountedRooms:
      saved.allowComplimentaryFoodOnDiscountedRooms ??
      DEFAULT_BREAKDOWN_CONFIG.allowComplimentaryFoodOnDiscountedRooms,
    glCodes: {
      netAccommodation:
        saved.glCodes?.netAccommodation || DEFAULT_BREAKDOWN_CONFIG.glCodes.netAccommodation,
      complimentaryBreakfast:
        saved.glCodes?.complimentaryBreakfast || DEFAULT_BREAKDOWN_CONFIG.glCodes.complimentaryBreakfast,
      vatPayable: saved.glCodes?.vatPayable || DEFAULT_BREAKDOWN_CONFIG.glCodes.vatPayable,
      serviceChargePayable:
        saved.glCodes?.serviceChargePayable || DEFAULT_BREAKDOWN_CONFIG.glCodes.serviceChargePayable,
    },
    roomTypeOverrides: saved.roomTypeOverrides,
  };
}

/**
 * Compute all four rate components for a given gross room rate.
 *
 * Supports both object syntax:
 *   computeRateBreakdown({ grossRate: 50000, hasApprovedDiscount: false, ... })
 * and positional syntax:
 *   computeRateBreakdown(50000, config, isDiscounted, roomTypeName, corporateOverride)
 */
export function computeRateBreakdown(
  optionsOrGrossRate: number | ComputeRateBreakdownOptions,
  config?: RoomRateBreakdownConfig,
  isDiscounted = false,
  roomTypeName?: string,
  corporateFoodAllocationOverride?: boolean | null,
): RateBreakdownResult {
  let grossRate: number;
  let resolvedConfig: RoomRateBreakdownConfig;
  let discounted = false;
  let resolvedTypeName: string | undefined;
  let corporateOverride: boolean | null | undefined;

  if (typeof optionsOrGrossRate === 'object' && optionsOrGrossRate !== null) {
    grossRate = Number(optionsOrGrossRate.grossRate || 0);
    const baseConfig = optionsOrGrossRate.config ?? DEFAULT_BREAKDOWN_CONFIG;
    resolvedConfig = {
      ...baseConfig,
      allowComplimentaryFoodOnDiscountedRooms:
        optionsOrGrossRate.allowComplimentaryFoodOnDiscountedRooms ??
        baseConfig.allowComplimentaryFoodOnDiscountedRooms,
    };
    discounted = Boolean(optionsOrGrossRate.hasApprovedDiscount);
    resolvedTypeName = optionsOrGrossRate.roomTypeName;
    corporateOverride = optionsOrGrossRate.corporateFoodAllocationOverride;
  } else {
    grossRate = Number(optionsOrGrossRate || 0);
    resolvedConfig = config ?? DEFAULT_BREAKDOWN_CONFIG;
    discounted = isDiscounted;
    resolvedTypeName = roomTypeName;
    corporateOverride = corporateFoodAllocationOverride;
  }

  if (!resolvedConfig.enabled || grossRate <= 0) {
    return {
      grossRate,
      netAccommodation: grossRate,
      vatAmount: 0,
      serviceChargeAmount: 0,
      complimentaryFoodAmount: 0,
      complimentaryAllocationName: resolvedConfig.complimentaryAllocationName,
      foodAllocationSuppressed: false,
      corporateOverrideApplied: false,
      suppressionReason: null,
      componentTotal: grossRate,
      balanced: true,
      vat: 0,
      serviceCharge: 0,
      complimentaryFoodAllocation: 0,
      isComplimentaryFoodAllocated: false,
      totalReconciled: grossRate,
    };
  }

  // Per-room-type overrides (accountant can set different amounts per type)
  const typeKey = resolvedTypeName?.toUpperCase();
  const override = typeKey ? resolvedConfig.roomTypeOverrides?.[typeKey] : undefined;
  const vatRate = override?.vatRate ?? resolvedConfig.vatRate;
  const serviceChargeRate = override?.serviceChargeRate ?? resolvedConfig.serviceChargeRate;
  const baseFoodAmount = override?.complimentaryFoodAmount ?? resolvedConfig.complimentaryFoodAmount;

  // Determine effective food amount based on corporate contract override or discount eligibility
  let foodAllocationSuppressed = false;
  let suppressionReason: string | null = null;
  let corporateOverrideApplied = false;

  if (typeof corporateOverride === 'boolean') {
    corporateOverrideApplied = true;
    if (!corporateOverride) {
      foodAllocationSuppressed = true;
      suppressionReason = 'Corporate rate agreement excludes complimentary food allocation';
    } else {
      foodAllocationSuppressed = false;
      suppressionReason = null;
    }
  } else if (discounted && !resolvedConfig.allowComplimentaryFoodOnDiscountedRooms) {
    foodAllocationSuppressed = true;
    suppressionReason = 'Approved room discount active';
  }

  const effectiveFoodAmount = foodAllocationSuppressed ? 0 : baseFoodAmount;

  // Derive net accommodation from the gross rate minus the fixed food component.
  // grossRate - food = net × (1 + vat% + sc%)
  const denominator = 1 + vatRate + serviceChargeRate;
  const grossMinusFood = Math.max(0, grossRate - effectiveFoodAmount);
  const netAccommodation = grossMinusFood / denominator;
  const vatAmount = netAccommodation * vatRate;
  const serviceChargeAmount = netAccommodation * serviceChargeRate;

  // Round to 2 decimal places — all hotel accounting is ₦0.01 precision
  const r = (n: number) => Math.round(n * 100) / 100;

  const netRounded = r(netAccommodation);
  const vatRounded = r(vatAmount);
  const scRounded = r(serviceChargeAmount);
  const foodRounded = r(effectiveFoodAmount);

  // Reconcile any penny-rounding difference onto netAccommodation
  const componentTotal = r(netRounded + vatRounded + scRounded + foodRounded);
  const delta = r(grossRate - componentTotal);
  const finalNet = r(netRounded + delta);

  const finalTotal = r(finalNet + vatRounded + scRounded + foodRounded);
  const balanced = Math.abs(finalTotal - grossRate) < 0.02;

  return {
    grossRate,
    netAccommodation: finalNet,
    vatAmount: vatRounded,
    serviceChargeAmount: scRounded,
    complimentaryFoodAmount: foodRounded,
    complimentaryAllocationName: resolvedConfig.complimentaryAllocationName,
    foodAllocationSuppressed,
    corporateOverrideApplied,
    suppressionReason,
    componentTotal: finalTotal,
    balanced,
    vat: vatRounded,
    serviceCharge: scRounded,
    complimentaryFoodAllocation: foodRounded,
    isComplimentaryFoodAllocated: foodRounded > 0,
    totalReconciled: finalTotal,
  };
}

/**
 * Pre-computed reference table matching the hotel's approved rate sheet.
 * Used for display and for quick validation of live computations.
 */
export const REFERENCE_RATE_TABLE = [
  { roomType: 'STANDARD',    gross: 30000, net: 21750, vat: 2250,  sc: 3000,  food: 3000 },
  { roomType: 'SUPERIOR',    gross: 33000, net: 24225, vat: 2475,  sc: 3300,  food: 3000 },
  { roomType: 'DELUXE',      gross: 35000, net: 25875, vat: 2625,  sc: 3500,  food: 3000 },
  { roomType: 'EXECUTIVE',   gross: 48000, net: 36600, vat: 3600,  sc: 4800,  food: 3000 },
  { roomType: 'STANZELSUITE',gross: 70000, net: 54750, vat: 5250,  sc: 7000,  food: 3000 },
] as const;

/**
 * Serializes the breakdown config to a compact JSON string suitable for
 * storing in LocalProperty.RateBreakdownJson (desktop offline sync).
 */
export function serializeBreakdownConfig(config: RoomRateBreakdownConfig): string {
  return JSON.stringify(config);
}

/**
 * Deserializes a breakdown config from a JSON string as stored offline.
 * If fallback is provided and JSON parsing fails or is empty, returns fallback
 * so an existing valid synced config is NEVER silently replaced by malformed data.
 */
export function deserializeBreakdownConfig(
  json: string | null | undefined,
  fallback?: RoomRateBreakdownConfig,
): RoomRateBreakdownConfig {
  if (!json || typeof json !== 'string' || !json.trim()) {
    return fallback ? { ...fallback } : { ...DEFAULT_BREAKDOWN_CONFIG };
  }
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') {
      if (fallback) return { ...fallback };
      throw new Error('MALFORMED_BREAKDOWN_CONFIG: Root JSON is not an object');
    }
    return resolveBreakdownConfig(parsed);
  } catch (err) {
    if (fallback) return { ...fallback };
    throw new Error(`MALFORMED_BREAKDOWN_CONFIG: ${(err as Error).message}`);
  }
}
