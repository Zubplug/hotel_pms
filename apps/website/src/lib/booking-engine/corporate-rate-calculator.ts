export type CorporateAdjustment = Readonly<{
  minNights?: number;
  maxNights?: number | null;
  minRooms?: number;
  maxRooms?: number | null;
  paymentModes?: string[];
  adjustmentType: 'PERCENT_DISCOUNT' | 'MULTIPLIER' | 'FIXED_NIGHTLY_ADJUSTMENT';
  value: number;
}>;

export type CorporatePricingFactors = Readonly<{
  stayLength?: CorporateAdjustment[];
  roomCount?: CorporateAdjustment[];
  paymentMode?: Record<string, CorporateAdjustment>;
}>;

function matches(adjustment: CorporateAdjustment, nights: number, rooms: number, paymentMode: string): boolean {
  if (adjustment.minNights != null && nights < adjustment.minNights) return false;
  if (adjustment.maxNights != null && nights > adjustment.maxNights) return false;
  if (adjustment.minRooms != null && rooms < adjustment.minRooms) return false;
  if (adjustment.maxRooms != null && rooms > adjustment.maxRooms) return false;
  if (adjustment.paymentModes?.length && !adjustment.paymentModes.map(value => value.toUpperCase()).includes(paymentMode.toUpperCase())) return false;
  return true;
}

function apply(amount: number, adjustment: CorporateAdjustment): number {
  if (adjustment.adjustmentType === 'PERCENT_DISCOUNT') return amount * (1 - adjustment.value / 100);
  if (adjustment.adjustmentType === 'MULTIPLIER') return amount * adjustment.value;
  return amount + adjustment.value;
}

/** Calculates the explicit contract nightly amount. It never reads a PMS/base rate. */
export function calculateCorporateNightlyRate(input: {
  baseNightlyAmount: number;
  nights: number;
  roomCount?: number;
  paymentMode: string;
  factors?: CorporatePricingFactors | null;
}): number {
  const rooms = input.roomCount ?? 1;
  const factors = input.factors ?? {};
  const adjustments = [
    ...(factors.stayLength ?? []).filter(item => matches(item, input.nights, rooms, input.paymentMode)),
    ...(factors.roomCount ?? []).filter(item => matches(item, input.nights, rooms, input.paymentMode)),
    ...(factors.paymentMode?.[input.paymentMode.toUpperCase()] ? [factors.paymentMode[input.paymentMode.toUpperCase()]] : []),
  ];
  const result = adjustments.reduce(apply, input.baseNightlyAmount);
  if (!Number.isFinite(result) || result < 0) throw new Error('Corporate pricing factors produced an invalid rate');
  return Math.round((result + Number.EPSILON) * 100) / 100;
}
