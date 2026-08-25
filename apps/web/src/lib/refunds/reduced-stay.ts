export type ReducedStayEstimate = {
  totalNights: number;
  availableNights: number;
  nightlyRoomAmount: number;
  estimatedAmount: number;
};

function dateOnly(value: string | Date): Date {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return new Date(`${text}T00:00:00Z`);
}

function calendarDaysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function getReducedStayEstimate(input: {
  checkIn?: string | Date;
  checkOut?: string | Date;
  status?: string;
  roomChargeTotal?: number;
  today?: Date;
}): ReducedStayEstimate {
  if (!input.checkIn || !input.checkOut) return { totalNights: 0, availableNights: 0, nightlyRoomAmount: 0, estimatedAmount: 0 };

  const checkIn = dateOnly(input.checkIn);
  const checkOut = dateOnly(input.checkOut);
  const totalNights = Math.max(0, calendarDaysBetween(checkIn, checkOut));
  const today = dateOnly(input.today || new Date());
  const elapsedNights = input.status === 'CHECKED_IN'
    ? Math.min(totalNights, Math.max(0, calendarDaysBetween(checkIn, today)))
    : 0;
  const availableNights = Math.max(0, totalNights - elapsedNights);
  const nightlyRoomAmount = totalNights > 0 ? Math.max(0, Number(input.roomChargeTotal || 0)) / totalNights : 0;

  return { totalNights, availableNights, nightlyRoomAmount, estimatedAmount: nightlyRoomAmount };
}
