import { getOrCreateBookingSystemActor, getOrCreateBookingSystemUser } from './system-actor';

async function resolveApprovalOwner(tx: any, propertyId: string, organizationId: string, requestedById: string, amount: number) {
  const rules = await tx.refundApprovalRule.findMany({
    where: { propertyId, isActive: true },
    orderBy: { stepOrder: 'asc' },
  });
  const matchingRule = rules.find((rule: any) =>
    (rule.minAmount == null || amount >= Number(rule.minAmount)) &&
    (rule.maxAmount == null || amount <= Number(rule.maxAmount)),
  );
  const fallbackRoleName = amount > 250000 ? 'FINANCE_MANAGER' : amount > 50000 ? 'MANAGER' : 'FRONT_DESK_MANAGER';
  const role = matchingRule?.roleId
    ? await tx.role.findUnique({ where: { id: matchingRule.roleId } })
    : await tx.role.findFirst({ where: { organizationId, name: fallbackRoleName } });
  const candidate = matchingRule?.approverId
    ? { userId: matchingRule.approverId }
    : role
      ? await tx.userRole.findFirst({
          where: { roleId: role.id, userId: { not: requestedById }, OR: [{ propertyId }, { propertyId: null }] },
          select: { userId: true },
        })
      : null;
  return { matchingRule, role, candidate };
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
      const { matchingRule, role, candidate } = await resolveApprovalOwner(
        input.tx,
        input.property.id,
        input.property.organizationId,
        requestedById,
        amount,
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
          currentApprovalStep: matchingRule?.stepOrder || 1,
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
            approverRoleId: role?.id,
            approverId: candidate?.userId,
            stepOrder: matchingRule?.stepOrder || 1,
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
