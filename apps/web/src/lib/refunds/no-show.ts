export type NoShowAssessment = {
  totalNights: number;
  bookedValue: number;
  noShowCharge: number;
  refundableAmount: number;
};

export function calculateNoShowAssessment(input: {
  checkIn: string | Date;
  checkOut: string | Date;
  bookedValue: number;
  totalPaid: number;
  chargeType: string;
  chargeValue: number;
  refundableUnusedNights: boolean;
}): NoShowAssessment {
  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);
  const totalNights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
  const bookedValue = Math.max(0, input.bookedValue);
  const firstNight = bookedValue / totalNights;
  const noShowCharge = input.chargeType === 'FULL_STAY'
    ? bookedValue
    : input.chargeType === 'PERCENTAGE'
      ? bookedValue * Math.max(0, input.chargeValue) / 100
      : input.chargeType === 'FIRST_NIGHT'
        ? firstNight
        : input.chargeType === 'FLAT'
          ? Math.max(0, input.chargeValue)
          : 0;
  const refundableAmount = input.refundableUnusedNights
    ? Math.max(0, Math.min(input.totalPaid, bookedValue || input.totalPaid) - noShowCharge)
    : 0;

  return { totalNights, bookedValue, noShowCharge, refundableAmount };
}
