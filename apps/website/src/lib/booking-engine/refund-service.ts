import { getOrCreateBookingSystemActor, getOrCreateBookingSystemUser } from './system-actor';

async function resolveCashierOwner(tx: any, propertyId: string, organizationId: string, requestedById: string) {
  const role = await tx.role.findFirst({ where: { organizationId, name: 'GENERAL_CASHIER' } });
  const candidate = role
    ? await tx.userRole.findFirst({
        where: { roleId: role.id, userId: { not: requestedById }, OR: [{ propertyId }, { propertyId: null }] },
        select: { userId: true },
      })
    : null;
  return { role, candidate };
}

/** Queues native refund requests for successful online booking payments. */
export async function queueBookingRefundRequests(input: {
  tx: any;
  reservation: any;
  property: any;
  totalPaid: number;
  cancellationPenalty: number;
  reason: string;
}) {
  if (input.totalPaid <= 0.01) return [];
  const requestedById = await getOrCreateBookingSystemUser(input.tx, input.property.organizationId);
  const requests: any[] = [];
  let remainingPenalty = Math.max(0, input.cancellationPenalty);

  for (const folio of input.reservation.folios || []) {
    for (const payment of folio.payments || []) {
      if (payment.status !== 'COMPLETED' || Number(payment.amount) <= 0) continue;
      const refunded = (payment.refunds || [])
        .filter((refund: any) => refund.status !== 'FAILED')
        .reduce((sum: number, refund: any) => sum + Number(refund.amount), 0);
      const available = Math.max(0, Number(payment.amount) - refunded);
      const penaltyShare = Math.min(available, remainingPenalty);
      remainingPenalty -= penaltyShare;
      const amount = available - penaltyShare;
      if (amount <= 0.01) continue;

      const idempotencyKey = `booking_cancel_refund_${input.reservation.id}_${payment.id}`;
      const existing = await input.tx.refundRequest.findUnique({ where: { idempotencyKey } });
      if (existing) {
        requests.push(existing);
        continue;
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const { role, candidate } = await resolveCashierOwner(
        input.tx,
        input.property.id,
        input.property.organizationId,
        requestedById,
      );
      const request = await input.tx.refundRequest.create({
        data: {
          organizationId: input.property.organizationId,
          propertyId: input.property.id,
          reservationId: input.reservation.id,
          folioId: folio.id,
          paymentId: payment.id,
          guestId: input.reservation.primaryGuestId,
          requestedAmount: amount,
          currency: payment.currency,
          requestedMethod: 'ORIGINAL_PAYMENT',
          category: 'RESERVATION_CANCELLED',
          reason: input.reason,
          requestedById,
          currentApproverId: candidate?.userId,
          approvalRoleId: role?.id,
          currentApprovalStep: 1,
          idempotencyKey,
          expiresAt,
        },
      });

      await input.tx.approvalRequest.create({
        data: {
          propertyId: input.property.id,
          type: 'REFUND',
          status: 'PENDING',
          requestedBy: await getOrCreateBookingSystemActor(input.tx as any, input.property.organizationId),
          amount,
          currency: payment.currency,
          reason: input.reason,
          details: {
            refundRequestId: request.id,
            category: 'RESERVATION_CANCELLED',
            requestedAmount: amount,
            requestedMethod: 'ORIGINAL_PAYMENT',
            stage: 'GENERAL_CASHIER_REVIEW',
            stepOrder: 1,
            approverRoleId: role?.id,
            approverId: candidate?.userId,
          },
          idempotencyKey: `approval:booking-refund:${request.id}`,
          expiresAt,
        },
      });
      requests.push(request);
    }
  }
  return requests;
}

/**
 * Corporate gateway payments settle through a shared City Ledger folio, so
 * they are not always reachable through Reservation.folios. Build the same
 * native refund requests from the durable BookingPaymentTransaction links.
 */
export async function queueCorporateGatewayRefundRequests(input: {
  tx: any;
  reservation: any;
  property: any;
  paymentGroupId?: string;
  reason: string;
}) {
  const transactions = await input.tx.bookingPaymentTransaction.findMany({
    where: input.paymentGroupId
      ? { corporatePaymentGroupId: input.paymentGroupId, status: 'SUCCESS', paymentId: { not: null } }
      : { reservationId: input.reservation.id, status: 'SUCCESS', paymentId: { not: null } },
    select: { paymentId: true },
  });
  const paymentIds = [...new Set(transactions.map((transaction: any) => transaction.paymentId).filter(Boolean))];
  if (!paymentIds.length) return [];
  const payments = await input.tx.payment.findMany({ where: { id: { in: paymentIds }, status: 'COMPLETED' }, include: { refunds: true } });
  const folios = payments.filter((payment: any) => payment.folioId).map((payment: any) => ({ id: payment.folioId, payments: [payment] }));
  const totalPaid = payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
  return queueBookingRefundRequests({ tx: input.tx, reservation: { ...input.reservation, folios }, property: input.property, totalPaid, cancellationPenalty: 0, reason: input.reason });
}
