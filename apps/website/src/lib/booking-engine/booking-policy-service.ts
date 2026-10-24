export class BookingPolicyError extends Error {
  constructor(readonly code: 'INVALID_DATES' | 'MIN_STAY' | 'MAX_STAY' | 'LEAD_TIME' | 'ADVANCE_WINDOW', message: string) { super(message); }
}

export function validateBookingPolicy(input: { checkIn: Date; checkOut: Date }, config: { minStay: number; maxStay: number | null; bookingLeadTimeHours: number; maxAdvanceDays: number | null }, now = new Date()): number {
  if (!Number.isFinite(input.checkIn.getTime()) || !Number.isFinite(input.checkOut.getTime()) || input.checkOut <= input.checkIn) throw new BookingPolicyError('INVALID_DATES', 'checkOut must be after checkIn');
  const nights = Math.ceil((input.checkOut.getTime() - input.checkIn.getTime()) / 86_400_000);
  if (nights < config.minStay) throw new BookingPolicyError('MIN_STAY', `Minimum stay is ${config.minStay} night(s)`);
  if (config.maxStay && nights > config.maxStay) throw new BookingPolicyError('MAX_STAY', `Maximum stay is ${config.maxStay} night(s)`);
  if (config.bookingLeadTimeHours > 0 && input.checkIn < new Date(now.getTime() + config.bookingLeadTimeHours * 3_600_000)) throw new BookingPolicyError('LEAD_TIME', `Bookings must be made at least ${config.bookingLeadTimeHours} hour(s) in advance`);
  if (config.maxAdvanceDays && input.checkIn > new Date(now.getTime() + config.maxAdvanceDays * 86_400_000)) throw new BookingPolicyError('ADVANCE_WINDOW', `Bookings cannot be made more than ${config.maxAdvanceDays} days in advance`);
  return nights;
}
