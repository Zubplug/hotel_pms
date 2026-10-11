export type CancellationQuote = {
  penaltyAmount: number;
  refundableAmount: number;
  penaltyDescription: string;
  policyName: string | null;
  hoursUntilCheckIn: number;
  policySnapshot: Record<string, unknown> | null;
  reservationAmount: number;
  refundMethod: string;
  estimatedProcessingTime: string;
};

export function calculateCancellationQuote(reservation: any, now = new Date()): CancellationQuote {
  const snapshot = (reservation.ratePlanSnapshot as any) || {};
  const policy = snapshot.cancellationPolicySnapshot || reservation.cancellationPolicy || null;
  // The persisted total is the amount quoted and paid by the guest. Keep
  // subtotal as a fallback for legacy reservations without a total snapshot.
  const reservationAmount = Number(snapshot.total ?? snapshot.subtotal ?? 0);
  const paid = (reservation.folios || []).reduce((sum: number, folio: any) => sum + (folio.payments || [])
    .filter((payment: any) => ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(payment.status))
    .reduce((inner: number, payment: any) => inner + Math.max(0, Number(payment.amount || 0)), 0), 0);
  const refunded = (reservation.folios || []).reduce((sum: number, folio: any) => sum + (folio.payments || [])
    .reduce((inner: number, payment: any) => inner + (payment.refunds || [])
      .filter((refund: any) => refund.status !== 'FAILED')
      .reduce((amount: number, refund: any) => amount + Number(refund.amount || 0), 0), 0), 0);
  const hoursUntilCheckIn = Math.max(0, (new Date(reservation.checkIn).getTime() - now.getTime()) / 3_600_000);
  let penaltyAmount = 0;
  let penaltyDescription = 'No cancellation fee applies';
  const penaltyType = String(policy?.penaltyType || 'NONE');
  if (policy && hoursUntilCheckIn < Number(policy.hoursBeforeCheckIn || 0) && penaltyType !== 'NONE') {
    if (penaltyType === 'FIRST_NIGHT') {
      const nights = Math.max(1, Math.ceil((new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) / 86_400_000));
      penaltyAmount = reservationAmount / nights;
      penaltyDescription = 'First night cancellation fee applies';
    } else if (penaltyType === 'PERCENTAGE') {
      penaltyAmount = reservationAmount * Number(policy.penaltyValue || 0) / 100;
      penaltyDescription = `${policy.penaltyValue}% cancellation fee applies`;
    } else if (penaltyType === 'FLAT') {
      penaltyAmount = Number(policy.penaltyValue || 0);
      penaltyDescription = `Flat cancellation fee of ${reservation.currency} ${policy.penaltyValue}`;
    }
  }
  penaltyAmount = Math.round(Math.max(0, penaltyAmount) * 100) / 100;
  return {
    penaltyAmount,
    refundableAmount: Math.max(0, Math.round((paid - refunded - penaltyAmount) * 100) / 100),
    penaltyDescription,
    policyName: policy?.name || null,
    hoursUntilCheckIn,
    policySnapshot: policy ? { id: policy.id, name: policy.name, type: policy.type, hoursBeforeCheckIn: policy.hoursBeforeCheckIn, penaltyType: policy.penaltyType, penaltyValue: Number(policy.penaltyValue || 0) } : null,
    reservationAmount,
    refundMethod: 'ORIGINAL_PAYMENT',
    estimatedProcessingTime: 'After approval, gateway refunds may take 3–15 business days.',
  };
}
