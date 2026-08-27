import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';
import { encrypt } from '@/lib/encryption';
import { getReducedStayEstimate } from '@/lib/refunds/reduced-stay';
import { findActiveFrontdeskSession } from '@/lib/frontdesk/active-session';

const ACTIVE_REQUEST_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING'] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id: paymentId } = await params;
    const body = await req.json();
    const amount = Number(body.amount);
    const reason = String(body.reason || '').trim();
    const category = String(body.category || 'MANUAL_ADJUSTMENT').toUpperCase();
    const reducedStayNights = Number(body.reducedStayNights);
    const requestedMethod = String(body.refundMethod || body.method || 'ORIGINAL_PAYMENT').toUpperCase();
    const bankAccountName = String(body.bankAccountName || '').trim();
    const bankAccountNumber = String(body.bankAccountNumber || '').replace(/\s+/g, '');
    const bankName = String(body.bankName || '').trim();
    const bankCode = String(body.bankCode || '').trim();
    const idempotencyKey = String(body.idempotencyKey || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !reason || !idempotencyKey || !['CASH', 'BANK_TRANSFER', 'ORIGINAL_PAYMENT'].includes(requestedMethod)) {
      return errorResponse('BAD_REQUEST', 'Amount, reason, and idempotencyKey are required', 400);
    }
    if (requestedMethod === 'BANK_TRANSFER' && (!bankAccountName || !/^\d{6,20}$/.test(bankAccountNumber) || !bankName)) {
      return errorResponse('BAD_REQUEST', 'Bank name, account name, and a valid account number are required for bank transfers', 400);
    }

    const capabilities = (session.user as any).capabilities || [];
    if (!capabilities.includes('ACCESS_REFUNDS')) {
      return errorResponse('FORBIDDEN', 'You do not have permission to request refunds.', 403);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { folio: { include: { property: true, items: true } }, reservation: true }
    });
    if (!payment) return errorResponse('NOT_FOUND', 'Payment not found', 404);

    const allowedProperties = await getUserPropertyIds(session.user.id);
    if (!allowedProperties.includes(payment.propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }
    if (requestedMethod === 'CASH') {
      const { session: activeFrontdeskSession } = await findActiveFrontdeskSession(session.user.id, payment.propertyId);
      if (!activeFrontdeskSession) return errorResponse('CONFLICT', 'Open your front desk cashier session before requesting a cash refund.', 409);
    }
    if (payment.status !== 'COMPLETED') {
      return errorResponse('BAD_REQUEST', 'Only completed payments can be refunded', 400);
    }

    const result = await prisma.$transaction(async tx => {
      const existing = await tx.refundRequest.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;

      const refunds = await tx.refund.aggregate({
        where: { paymentId, status: { not: 'FAILED' } },
        _sum: { amount: true }
      });
      const pending = await tx.refundRequest.aggregate({
        where: { paymentId, status: { in: ACTIVE_REQUEST_STATUSES as any } },
        _sum: { requestedAmount: true }
      });
      const alreadyCommitted = Number(refunds._sum.amount || 0) + Number(pending._sum.requestedAmount || 0);
      if (alreadyCommitted + amount > Number(payment.amount)) {
        throw new Error('REFUND_LIMIT_EXCEEDED');
      }

      if (category === 'FOLIO_CREDIT_BALANCE' && Number(payment.folio.balance) >= 0) {
        throw new Error('REFUND_REQUIRES_CREDIT_BALANCE');
      }
      if (category === 'RESERVATION_CANCELLED' && payment.reservation?.status !== 'CANCELLED') {
        throw new Error('REFUND_REQUIRES_CANCELLED_RESERVATION');
      }
      if (category === 'REDUCED_STAY' && !payment.reservation) {
        throw new Error('REFUND_REQUIRES_RESERVATION');
      }
      if (category === 'NO_SHOW') {
        if (payment.reservation?.status !== 'NO_SHOW') throw new Error('REFUND_REQUIRES_NO_SHOW');
        const maximumEligible = Number(payment.reservation.noShowRefundableAmount || 0);
        if (maximumEligible <= 0 || amount > maximumEligible) throw new Error('NO_SHOW_REFUND_LIMIT_EXCEEDED');
      }
      if (category === 'REDUCED_STAY') {
        const roomChargeTotal = payment.folio.items
          .filter(item => item.source === 'ROOM_CHARGE' && item.type === 'CHARGE' && !item.voidedAt)
          .reduce((sum, item) => sum + Number(item.amount), 0);
        const estimate = getReducedStayEstimate({
          checkIn: payment.reservation?.checkIn,
          checkOut: payment.reservation?.checkOut,
          status: payment.reservation?.status,
          roomChargeTotal,
        });
        if (!Number.isInteger(reducedStayNights) || reducedStayNights <= 0 || reducedStayNights > estimate.availableNights) {
          throw new Error('INVALID_REDUCED_STAY_NIGHTS');
        }
        const expectedAmount = reducedStayNights * estimate.nightlyRoomAmount;
        if (expectedAmount <= 0 || Math.abs(amount - expectedAmount) > 0.01) {
          throw new Error('INVALID_REDUCED_STAY_AMOUNT');
        }
      }

      const workflowRules = await tx.refundApprovalRule.findMany({ where: { propertyId: payment.propertyId, isActive: true }, orderBy: { stepOrder: 'asc' } });
      const matchingRules = workflowRules.filter(rule => (rule.minAmount == null || amount >= Number(rule.minAmount)) && (rule.maxAmount == null || amount <= Number(rule.maxAmount)));
      const firstRule = matchingRules[0];
      const fallbackRoleName = amount > 250000 ? 'FINANCE_MANAGER' : amount > 50000 ? 'MANAGER' : 'FRONT_DESK_MANAGER';
      const role = firstRule?.roleId ? await tx.role.findUnique({ where: { id: firstRule.roleId } }) : await tx.role.findFirst({ where: { organizationId: payment.folio.property.organizationId, name: fallbackRoleName } });
      const candidate = firstRule?.approverId
        ? { userId: firstRule.approverId }
        : role ? await tx.userRole.findFirst({ where: { roleId: role.id, userId: { not: session.user.id }, OR: [{ propertyId: payment.propertyId }, { propertyId: null }] }, select: { userId: true } }) : null;

      const request = await tx.refundRequest.create({
        data: {
          organizationId: payment.folio.property.organizationId,
          propertyId: payment.propertyId,
          reservationId: payment.reservationId,
          folioId: payment.folioId,
          paymentId,
          guestId: payment.reservation?.primaryGuestId,
          requestedAmount: amount,
          currency: payment.currency,
          requestedMethod,
          bankAccountName: requestedMethod === 'BANK_TRANSFER' ? bankAccountName : null,
          bankAccountNumberEncrypted: requestedMethod === 'BANK_TRANSFER' ? encrypt(bankAccountNumber) : null,
          bankAccountLast4: requestedMethod === 'BANK_TRANSFER' ? bankAccountNumber.slice(-4) : null,
          bankName: requestedMethod === 'BANK_TRANSFER' ? bankName : null,
          bankCode: requestedMethod === 'BANK_TRANSFER' ? bankCode || null : null,
          category,
          reason,
          supportingNotes: [
            body.supportingNotes ? String(body.supportingNotes) : null,
            category === 'REDUCED_STAY' ? `Reduced stay nights: ${reducedStayNights}` : null,
          ].filter(Boolean).join('\n') || null,
          requestedById: session.user.id,
          currentApproverId: candidate?.userId,
          approvalRoleId: role?.id,
          currentApprovalStep: firstRule?.stepOrder || 1,
          idempotencyKey,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      await tx.approvalRequest.create({
        data: {
          propertyId: payment.propertyId,
          type: 'REFUND',
          status: 'PENDING',
          requestedBy: session.user.id,
          amount,
          currency: payment.currency,
          reason,
          details: { refundRequestId: request.id, category, requestedAmount: amount, approvedAmount: null, requestedMethod, approverRoleId: role?.id, approverId: candidate?.userId, stepOrder: firstRule?.stepOrder || 1 },
          expiresAt: request.expiresAt
        }
      });

      return request;
    });

    return successResponse({ status: result.status, refundRequest: result }, 202);
  } catch (error: any) {
    const messages: Record<string, [string, string, number]> = {
      REFUND_LIMIT_EXCEEDED: ['CONFLICT', 'Total refunded and pending amounts exceed the original payment.', 409],
      REFUND_REQUIRES_CREDIT_BALANCE: ['BAD_REQUEST', 'A credit balance is required for this refund category.', 400],
      REFUND_REQUIRES_CANCELLED_RESERVATION: ['BAD_REQUEST', 'The reservation must be cancelled first.', 400],
      REFUND_REQUIRES_RESERVATION: ['BAD_REQUEST', 'This refund category requires a reservation.', 400],
      INVALID_REDUCED_STAY_NIGHTS: ['BAD_REQUEST', 'The reduced-stay nights are no longer available.', 400],
      INVALID_REDUCED_STAY_AMOUNT: ['BAD_REQUEST', 'The reduced-stay refund amount changed; please recalculate it.', 400],
      REFUND_REQUIRES_NO_SHOW: ['BAD_REQUEST', 'The reservation must be assessed as a no-show first.', 400],
      NO_SHOW_REFUND_LIMIT_EXCEEDED: ['CONFLICT', 'The requested refund exceeds the no-show eligible balance.', 409]
    };
    const mapped = messages[error.message];
    if (mapped) return errorResponse(mapped[0], mapped[1], mapped[2]);
    if (error.code === 'P2002') return errorResponse('CONFLICT', 'A refund request with this idempotency key already exists.', 409);
    console.error('[Refund Request POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to create refund request', 500);
  }
}
