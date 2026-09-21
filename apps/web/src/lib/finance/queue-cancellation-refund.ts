import { CityLedgerAccountingService } from '@/lib/services/city-ledger-accounting-service';
import { getPropertyBusinessDate } from '@/lib/date-utils';

const ACTIVE_REFUND_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING'] as const;

type QueueCancellationRefundInput = {
  tx: any;
  reservation: any;
  propertyId: string;
  organizationId: string;
  requestedById: string;
  reason: string;
  cancellationPenalty?: number;
  totalPaid?: number;
};

async function resolveApprovalOwner(
  tx: any,
  propertyId: string,
  organizationId: string,
  requestedById: string,
  amount: number,
) {
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
          where: {
            roleId: role.id,
            userId: { not: requestedById },
            OR: [{ propertyId }, { propertyId: null }],
          },
          select: { userId: true },
        })
      : null;

  return { matchingRule, role, candidate };
}

async function cancelDuplicateDirectRefunds(tx: any, input: QueueCancellationRefundInput, folioId: string) {
  const requests = await tx.refundRequest.findMany({
    where: {
      reservationId: input.reservation.id,
      folioId,
      cityLedgerEntryId: null,
      category: 'RESERVATION_CANCELLED',
      status: { in: ACTIVE_REFUND_STATUSES as any },
    },
    select: { id: true, requestedAmount: true },
  });

  for (const request of requests) {
    await tx.refundRequest.update({ where: { id: request.id }, data: { status: 'CANCELLED' } });
    await tx.approvalRequest.updateMany({
      where: { type: 'REFUND', details: { path: ['refundRequestId'], equals: request.id } },
      data: { status: 'CANCELLED' },
    });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        userId: input.requestedById,
        action: 'CANCELLATION_REFUND_CONVERTED_TO_GUEST_CREDIT',
        resource: 'RefundRequest',
        resourceId: request.id,
        newValue: {
          status: 'CANCELLED',
          reason: 'Existing unspent folio credit is managed through Guest Credits.',
          reservationId: input.reservation.id,
          folioId,
        },
        requestId: `convert-credit:${request.id}`,
      },
    });
  }
}

async function transferFolioCreditToRefundPayable(
  input: QueueCancellationRefundInput,
  folio: any,
  amount: number,
  currency: string,
  businessDate: Date,
) {
  const reference = `CXL-CR-${input.reservation.id}-${folio.id}`;
  const existingEntry = await input.tx.cityLedgerEntry.findFirst({ where: { reference } });
  let entry = existingEntry;
  if (!entry) {
    let account = await input.tx.cityLedgerAccount.findFirst({
      where: { propertyId: input.propertyId, type: 'REFUND_PAYABLE', name: 'Pending Guest Refunds', status: 'ACTIVE' },
    });
    if (!account) {
      account = await input.tx.cityLedgerAccount.create({
        data: {
          organizationId: input.organizationId,
          propertyId: input.propertyId,
          name: 'Pending Guest Refunds',
          type: 'REFUND_PAYABLE',
          currency,
        },
      });
    }

    entry = await input.tx.cityLedgerEntry.create({
      data: {
        accountId: account.id,
        propertyId: input.propertyId,
        guestId: input.reservation.primaryGuestId,
        reservationId: input.reservation.id,
        folioId: folio.id,
        amount,
        currency,
        type: 'REFUND_OWED',
        status: 'OPEN',
        reference,
        reason: 'Reservation cancelled with unspent guest credit; awaiting accountant refund request',
        createdBy: input.requestedById,
      },
    });

    await input.tx.cityLedgerAccount.update({ where: { id: account.id }, data: { balance: { decrement: amount } } });
    await CityLedgerAccountingService.processCityLedgerRouting(
      input.tx,
      input.propertyId,
      input.organizationId,
      input.requestedById,
      -amount,
      folio.id,
      reference,
      `cxl-credit-routing:${input.reservation.id}:${folio.id}`,
      businessDate,
    );
  }

  const credits = await input.tx.folioCredit.findMany({
    where: {
      folioId: folio.id,
      propertyId: input.propertyId,
      status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] },
      remainingAmount: { gt: 0 },
    },
    orderBy: { createdAt: 'asc' },
  });
  let remaining = amount;
  for (const credit of credits) {
    if (remaining <= 0.01) break;
    const applied = Math.min(remaining, Number(credit.remainingAmount));
    const key = `CXL_REFUND_OWED:${input.reservation.id}:${credit.id}`;
    const application = await input.tx.folioCreditApplication.findUnique({ where: { idempotencyKey: key } });
    if (!application) {
      const createdApplication = await input.tx.folioCreditApplication.create({
        data: {
          creditId: credit.id,
          folioId: folio.id,
          amount: applied,
          currency,
          source: 'CANCELLATION_REFUND_OWED',
          description: `Transferred to guest refund payable entry ${entry.id}`,
          idempotencyKey: key,
          appliedBy: input.requestedById,
          businessDate,
        },
      });
      await input.tx.folioCredit.update({
        where: { id: credit.id },
        data: {
          remainingAmount: { decrement: applied },
          status: applied >= Number(credit.remainingAmount) - 0.01 ? 'EXHAUSTED' : 'PARTIALLY_APPLIED',
        },
      });
      await input.tx.financialAuditLog.create({
        data: {
          operationId: key,
          propertyId: input.propertyId,
          reservationId: input.reservation.id,
          folioId: folio.id,
          guestId: input.reservation.primaryGuestId,
          creditId: credit.id,
          creditApplicationId: createdApplication.id,
          operationType: 'CANCELLATION_REFUND_OWED_TRANSFER',
          amount: applied,
          currency,
          operatorId: input.requestedById,
          businessDate,
          reason: `Reservation cancellation credit transferred to ${entry.id}`,
          approvalStatus: 'NOT_REQUIRED',
          idempotencyKey: `audit:${key}`,
          metadata: { source: 'RESERVATION_CANCELLATION', cityLedgerEntryId: entry.id },
        },
      });
    }
    remaining -= applied;
  }

  await cancelDuplicateDirectRefunds(input.tx, input, folio.id);
  return entry;
}

async function queueDirectRefundRequest(input: QueueCancellationRefundInput, folio: any, payment: any, amount: number, reason: string) {
  if (amount <= 0.01) return null;
  const idempotencyKey = `reservation_cancel_refund_${input.reservation.id}_${payment.id}`;
  const existing = await input.tx.refundRequest.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;
  const { matchingRule, role, candidate } = await resolveApprovalOwner(input.tx, input.propertyId, input.organizationId, input.requestedById, amount);
  const request = await input.tx.refundRequest.create({
    data: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      reservationId: input.reservation.id,
      folioId: folio.id,
      paymentId: payment.id,
      guestId: input.reservation.primaryGuestId,
      requestedAmount: amount,
      currency: payment.currency,
      requestedMethod: 'ORIGINAL_PAYMENT',
      category: 'RESERVATION_CANCELLED',
      reason,
      requestedById: input.requestedById,
      currentApproverId: candidate?.userId,
      approvalRoleId: role?.id,
      currentApprovalStep: matchingRule?.stepOrder || 1,
      idempotencyKey,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  await input.tx.approvalRequest.create({
    data: {
      propertyId: input.propertyId,
      type: 'REFUND',
      status: 'PENDING',
      requestedBy: input.requestedById,
      amount,
      currency: payment.currency,
      reason,
      idempotencyKey: `approval:refund:${request.id}`,
      details: {
        refundRequestId: request.id,
        category: request.category,
        requestedAmount: amount,
        requestedMethod: 'ORIGINAL_PAYMENT',
        approverRoleId: role?.id,
        approverId: candidate?.userId,
        stepOrder: matchingRule?.stepOrder || 1,
      },
      expiresAt: request.expiresAt,
    },
  });
  return request;
}

export async function queueCancellationRefunds(input: QueueCancellationRefundInput) {
  const property = await input.tx.property.findUnique({ where: { id: input.propertyId }, select: { businessDate: true, timezone: true } });
  const businessDate = property?.businessDate || getPropertyBusinessDate(property?.timezone);
  const refundRequests: any[] = [];

  for (const folio of input.reservation.folios || []) {
    const credits = await input.tx.folioCredit.findMany({
      where: { folioId: folio.id, propertyId: input.propertyId, status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] }, remainingAmount: { gt: 0 } },
      select: { remainingAmount: true },
    });
    const availableCredit = credits.reduce((sum: number, credit: any) => sum + Number(credit.remainingAmount), 0);

    if (availableCredit > 0.01) {
      await transferFolioCreditToRefundPayable(input, folio, availableCredit, folio.currency || input.reservation.currency || 'NGN', businessDate);
      continue;
    }

    for (const payment of folio.payments || []) {
      if (payment.status !== 'COMPLETED') continue;
      const refunded = (payment.refunds || [])
        .filter((refund: any) => refund.status !== 'FAILED')
        .reduce((sum: number, refund: any) => sum + Number(refund.amount), 0);
      const pending = await input.tx.refundRequest.aggregate({
        where: { paymentId: payment.id, status: { in: ACTIVE_REFUND_STATUSES as any } },
        _sum: { requestedAmount: true },
      });
      const paymentPenalty = input.totalPaid && input.totalPaid > 0
        ? (input.cancellationPenalty || 0) * Number(payment.amount) / input.totalPaid
        : 0;
      const amount = Number(payment.amount) - refunded - Number(pending._sum.requestedAmount || 0) - paymentPenalty;
      const request = await queueDirectRefundRequest(input, folio, payment, amount, `Reservation cancelled: ${input.reason}`);
      if (request) refundRequests.push(request);
    }
  }

  return refundRequests;
}
