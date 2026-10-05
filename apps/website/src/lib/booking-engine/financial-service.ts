import { FolioPaymentAccountingService } from '@/lib/services/folio-payment-accounting-service';

/**
 * Booking-engine payments use the same folio primitives as Front Desk
 * advance deposits: a native Payment plus an available FolioCredit. Keeping
 * this operation transactional prevents a gateway payment from being posted
 * without the guest-credit record used by offline settlement.
 */
export async function postBookingAdvanceDeposit(input: {
  tx: any;
  folio: any;
  reservation: any;
  property: any;
  amount: number;
  currency: string;
  providerRef: string;
  providerTransactionId: string;
  businessDate: Date;
  systemActorId: string;
}) {
  const paymentIdempotencyKey = `BK_WEBHOOK_${input.providerRef}`;
  const existingPayment = await input.tx.payment.findUnique({ where: { idempotencyKey: paymentIdempotencyKey } });
  if (existingPayment) return existingPayment;

  const payment = await input.tx.payment.create({
    data: {
      folioId: input.folio.id,
      reservationId: input.reservation.id,
      propertyId: input.folio.propertyId,
      method: 'PAYMENT_GATEWAY',
      provider: 'PAYSTACK',
      providerRef: input.providerRef,
      providerTransactionId: input.providerTransactionId,
      amount: input.amount,
      currency: input.currency,
      baseAmount: input.amount,
      status: 'COMPLETED',
      businessDate: input.businessDate,
      idempotencyKey: paymentIdempotencyKey,
      collectionSource: 'BOOKING_ENGINE',
      receivedBy: input.systemActorId,
      notes: `Booking Engine advance deposit via Paystack. Ref: ${input.providerRef}`,
    },
  });

  await input.tx.folioCredit.create({
    data: {
      folioId: input.folio.id,
      reservationId: input.reservation.id,
      propertyId: input.folio.propertyId,
      amount: input.amount,
      remainingAmount: input.amount,
      currency: input.currency,
      method: 'PAYMENT_GATEWAY',
      status: 'AVAILABLE',
      reference: input.providerRef,
      notes: 'Online booking advance deposit',
      receivedBy: input.systemActorId,
      operationId: paymentIdempotencyKey,
      idempotencyKey: `BK_CREDIT_${input.providerRef}`,
      businessDate: input.businessDate,
    },
  });

  await FolioPaymentAccountingService.processPaymentAccounting(
    input.tx,
    payment,
    input.folio.propertyId,
    input.property.organizationId,
    null,
  );

  await input.tx.folio.update({
    where: { id: input.folio.id },
    data: {
      totalPayments: { increment: input.amount },
      balance: Number(input.folio.totalCharges) - (Number(input.folio.totalPayments) + input.amount),
    },
  });

  return payment;
}
