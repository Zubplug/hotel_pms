import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { PaystackProvider } from '@/lib/payment-providers/paystack';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['FRONT_DESK_MANAGER', 'MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Manager access required', 403);
    }
    const body = await req.json().catch(() => ({}));
    const selectedMethod = String(body.refundMethod || '').toUpperCase();

    const allowedPropertyIds = user.allowedProperties;
    
    // Begin an atomic transaction to ensure idempotency and safety
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Fetch the request
      const approval = await tx.approvalRequest.findUnique({
        where: { id: (await params).id },
      });

      if (!approval) {
        throw new Error('NOT_FOUND');
      }

      // 2. Validate Authorization / Property Scope
      if (!allowedPropertyIds.includes(approval.propertyId)) {
        throw new Error('FORBIDDEN');
      }

      if (approval.type === 'REFUND') {
        if (approval.status !== 'PENDING') throw new Error('CONFLICT');
        const details = (approval.details || {}) as { refundRequestId?: string; approverId?: string; approverRoleId?: string; posRefund?: boolean; orderId?: string; amount?: number; method?: string };
        if (details.approverId && details.approverId !== user.id) {
          throw new Error('ASSIGNED_APPROVER_REQUIRED');
        }
        if (details.approverRoleId && !await tx.userRole.findFirst({ where: { userId: user.id, roleId: details.approverRoleId, OR: [{ propertyId: approval.propertyId }, { propertyId: null }] } })) {
          throw new Error('ASSIGNED_ROLE_REQUIRED');
        }
        if (details.posRefund) {
          const order = await tx.posOrder.findUnique({ where: { id: details.orderId || '' }, include: { payments: true } });
          if (!order) throw new Error('NOT_FOUND');
          const amount = Number(details.amount || 0);
          const paid = order.payments.filter((payment: any) => Number(payment.amount) > 0).reduce((total: number, payment: any) => total + Number(payment.amount), 0);
          const refunded = order.payments.filter((payment: any) => Number(payment.amount) < 0).reduce((total: number, payment: any) => total + Math.abs(Number(payment.amount)), 0);
          if (!Number.isFinite(amount) || amount <= 0 || refunded + amount > paid) throw new Error('REFUND_LIMIT_EXCEEDED');
          await tx.posPayment.create({
            data: {
              orderId: order.id,
              method: (details.method || 'CASH') as any,
              status: 'CONFIRMED',
              amount: -amount,
              currency: 'NGN',
              operationId: `refund-approval:${approval.id}`,
              businessDate: new Date(),
              paidAt: new Date()
            }
          });
          const updated = await tx.approvalRequest.update({ where: { id: approval.id }, data: { status: 'APPROVED', reviewedBy: user.id, reviewedAt: new Date() } });
          return { status: 'COMPLETED', approval: updated };
        }
        const refundRequest = await tx.refundRequest.findUnique({
          where: { id: details.refundRequestId || '' },
          include: { payment: true, folio: true, reservation: true }
        });
        if (!refundRequest || refundRequest.status !== 'PENDING_APPROVAL') throw new Error('CONFLICT');
        if (refundRequest.requestedById === user.id) throw new Error('SELF_APPROVAL');

        const committed = await tx.refund.aggregate({ where: { paymentId: refundRequest.paymentId, status: { not: 'FAILED' } }, _sum: { amount: true } });
        const pending = await tx.refundRequest.aggregate({
          where: { paymentId: refundRequest.paymentId, id: { not: refundRequest.id }, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING'] } },
          _sum: { requestedAmount: true }
        });
        if (Number(committed._sum.amount || 0) + Number(pending._sum.requestedAmount || 0) + Number(refundRequest.requestedAmount) > Number(refundRequest.payment.amount)) {
          throw new Error('REFUND_LIMIT_EXCEEDED');
        }
        if (refundRequest.category === 'RESERVATION_CANCELLED' && refundRequest.reservation?.status !== 'CANCELLED') {
          throw new Error('REFUND_REQUIRES_CANCELLED_RESERVATION');
        }

        const workflowRules = await tx.refundApprovalRule.findMany({ where: { propertyId: refundRequest.propertyId, isActive: true }, orderBy: { stepOrder: 'asc' } }) as Array<{ minAmount: number | string | null; maxAmount: number | string | null; stepOrder: number; roleId: string | null; approverId: string | null }>;
        const matchingRules = workflowRules.filter(rule => (rule.minAmount == null || Number(refundRequest.requestedAmount) >= Number(rule.minAmount)) && (rule.maxAmount == null || Number(refundRequest.requestedAmount) <= Number(rule.maxAmount)));
        const nextRule = matchingRules.find(rule => rule.stepOrder > refundRequest.currentApprovalStep);
        if (nextRule) {
          const nextRole = nextRule.roleId ? await tx.role.findUnique({ where: { id: nextRule.roleId } }) : null;
          const nextApprover = nextRule.approverId ? { userId: nextRule.approverId } : nextRole ? await tx.userRole.findFirst({ where: { roleId: nextRole.id, userId: { not: refundRequest.requestedById }, OR: [{ propertyId: refundRequest.propertyId }, { propertyId: null }] }, select: { userId: true } }) : null;
          await tx.refundRequest.update({ where: { id: refundRequest.id }, data: { currentApprovalStep: nextRule.stepOrder, currentApproverId: nextApprover?.userId || null, approvalRoleId: nextRole?.id || null } });
          await tx.refundApproval.create({ data: { refundRequestId: refundRequest.id, approverId: user.id, decision: 'APPROVED', stepOrder: refundRequest.currentApprovalStep } });
          await tx.approvalRequest.update({ where: { id: approval.id }, data: { status: 'APPROVED', reviewedBy: user.id, reviewedAt: new Date() } });
          await tx.approvalRequest.create({ data: { propertyId: refundRequest.propertyId, type: 'REFUND', status: 'PENDING', requestedBy: refundRequest.requestedById, amount: refundRequest.requestedAmount, currency: refundRequest.currency, reason: refundRequest.reason, expiresAt: refundRequest.expiresAt, details: { refundRequestId: refundRequest.id, category: refundRequest.category, requestedAmount: Number(refundRequest.requestedAmount), stepOrder: nextRule.stepOrder, approverRoleId: nextRole?.id, approverId: nextApprover?.userId } } });
          return { status: 'PENDING_APPROVAL', refundRequestId: refundRequest.id, nextApprovalStep: nextRule.stepOrder };
        }

        const claimed = await tx.refundRequest.updateMany({
          where: { id: refundRequest.id, status: 'PENDING_APPROVAL' },
          data: { status: 'PROCESSING', approvedAmount: refundRequest.requestedAmount }
        });
        if (claimed.count !== 1) throw new Error('CONFLICT');
        await tx.refundApproval.create({ data: { refundRequestId: refundRequest.id, approverId: user.id, decision: 'APPROVED' } });

        const amount = Number(refundRequest.requestedAmount);
        const settlementMethod = selectedMethod || refundRequest.approvedMethod || refundRequest.requestedMethod || 'ORIGINAL_PAYMENT';
        if (!['CASH', 'BANK_TRANSFER', 'ORIGINAL_PAYMENT'].includes(settlementMethod)) throw new Error('INVALID_REFUND_METHOD');
        if (settlementMethod === 'BANK_TRANSFER' && !refundRequest.bankAccountNumberEncrypted) throw new Error('BANK_DETAILS_REQUIRED');
        if (settlementMethod === 'CASH' || settlementMethod === 'BANK_TRANSFER') {
          await tx.refundRequest.update({ where: { id: refundRequest.id }, data: { status: 'APPROVED', approvedMethod: settlementMethod } });
          await tx.approvalRequest.update({ where: { id: approval.id }, data: { status: 'APPROVED', reviewedBy: user.id, reviewedAt: new Date() } });
          return { status: 'APPROVED', refundRequestId: refundRequest.id, method: settlementMethod, message: settlementMethod === 'CASH' ? 'Cash refund is awaiting cash-office settlement.' : 'Bank transfer refund is awaiting finance settlement.' };
        }
        await tx.refundRequest.update({ where: { id: refundRequest.id }, data: { approvedMethod: settlementMethod } });
        await tx.approvalRequest.update({ where: { id: approval.id }, data: { status: 'APPROVED', reviewedBy: user.id, reviewedAt: new Date() } });
        return {
          status: 'PROCESSING',
          refundRequestId: refundRequest.id,
          paymentId: refundRequest.paymentId,
          folioId: refundRequest.folioId,
          propertyId: refundRequest.propertyId,
          currency: refundRequest.currency,
          reason: refundRequest.reason,
          amount,
          method: settlementMethod,
          providerTransactionId: refundRequest.payment.providerTransactionId,
          requestedBy: user.id,
          committedRefunded: Number(committed._sum.amount || 0),
          requestApprovalId: approval.id
        };
      }

      // 3. Idempotency Check (Only allow PENDING to APPROVED)
      if (approval.status !== 'PENDING') {
        throw new Error('CONFLICT');
      }

      // 4. State Transition
      const updatedApproval = await tx.approvalRequest.update({
        where: { id: (await params).id },
        data: {
          status: 'APPROVED',
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      // 5. Audit Log (Immutable record)
      await tx.auditLog.create({
        data: {
          organizationId: (await tx.property.findUnique({ where: { id: approval.propertyId } }))?.organizationId || '',
          propertyId: approval.propertyId,
          userId: user.id,
          action: 'APPROVE_REQUEST',
          resource: 'ApprovalRequest',
          resourceId: approval.id,
          newValue: { type: approval.type, amount: approval.amount },
          ipAddress: req.headers.get('x-forwarded-for') || '',
          userAgent: req.headers.get('user-agent') || '',
          requestId: crypto.randomUUID()
        }
      });

      // 6. Execute the actual business logic based on type (e.g. Refund, Void)
      // In a real system, you'd integrate with the payment gateway or POS service here.
      if (approval.type === 'REFUND') {
         // Perform refund operation securely
      } else if (approval.type === 'VOID') {
         // Perform void operation
      }

      return updatedApproval;
    });

    if (result && typeof result === 'object' && 'providerTransactionId' in result) {
      const gatewayResult = await executeGatewayRefund(result);
      const finalized = await prisma.$transaction(async tx => {
        const current = await tx.refundRequest.findUnique({ where: { id: result.refundRequestId }, include: { payment: true } });
        if (!current || current.status !== 'PROCESSING') throw new Error('CONFLICT');
        const completed = gatewayResult.status === 'COMPLETED';
        const refund = await tx.refund.create({ data: {
          refundRequestId: current.id,
          paymentId: result.paymentId,
          folioId: result.folioId,
          propertyId: result.propertyId,
            amount: result.amount,
            currency: result.currency,
            method: result.method,
          reason: result.reason,
          authorizedBy: user.id,
          providerRefundId: gatewayResult.providerRefundId,
          status: gatewayResult.status,
          idempotencyKey: `refund-request:${current.id}`
        } });
        if (completed) {
          const folio = await tx.folio.findUnique({ where: { id: result.folioId } });
          if (!folio) throw new Error('NOT_FOUND');
          const updatedFolio = await tx.folio.updateMany({ where: { id: folio.id, version: folio.version }, data: { version: { increment: 1 }, totalPayments: { decrement: result.amount }, balance: { increment: result.amount } } });
          if (updatedFolio.count !== 1) throw new Error('CONFLICT');
          await tx.folioItem.create({ data: { folioId: folio.id, businessDate: new Date(), type: 'REFUND', source: 'MANUAL', description: `Refund request ${current.id}`, quantity: 1, unitAmount: result.amount, amount: result.amount, currency: result.currency, baseAmount: result.amount, postedBy: user.id } });
          const totalRefunded = result.committedRefunded + result.amount;
          await tx.payment.update({ where: { id: result.paymentId }, data: { status: totalRefunded >= Number(current.payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
        }
        await tx.refundRequest.update({ where: { id: current.id }, data: { status: completed ? 'COMPLETED' : gatewayResult.status === 'FAILED' ? 'FAILED' : 'PROCESSING' } });
        const property = await tx.property.findUnique({ where: { id: result.propertyId } });
        await tx.auditLog.create({ data: {
          organizationId: property?.organizationId || '',
          propertyId: result.propertyId,
          userId: user.id,
          action: 'APPROVE_REFUND_REQUEST',
          resource: 'RefundRequest',
          resourceId: current.id,
          newValue: { status: completed ? 'COMPLETED' : gatewayResult.status, amount: result.amount, providerRefundId: gatewayResult.providerRefundId },
          ipAddress: req.headers.get('x-forwarded-for') || '',
          userAgent: req.headers.get('user-agent') || '',
          requestId: crypto.randomUUID()
        } });
        return { status: completed ? 'COMPLETED' : gatewayResult.status, refundRequestId: current.id, refundId: refund.id, providerRefundId: gatewayResult.providerRefundId };
      });
      return successResponse(finalized, 200);
    }

    return successResponse(result, 200);

  } catch (err: any) {
    console.error(`[Manager Approve API POST] Error: ${err.message}`);
    
    if (err.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Approval request not found', 404);
    if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Access denied to this property', 403);
    if (err.message === 'ASSIGNED_APPROVER_REQUIRED') return errorResponse('FORBIDDEN', 'This refund is assigned to another approver.', 403);
    if (err.message === 'ASSIGNED_ROLE_REQUIRED') return errorResponse('FORBIDDEN', 'You do not hold the approval role assigned to this refund.', 403);
    if (err.message === 'SELF_APPROVAL') return errorResponse('FORBIDDEN', 'The requester cannot approve their own refund.', 403);
    if (err.message === 'REFUND_LIMIT_EXCEEDED') return errorResponse('CONFLICT', 'The refundable amount changed; this request cannot be approved.', 409);
    if (err.message === 'REFUND_REQUIRES_CANCELLED_RESERVATION') return errorResponse('BAD_REQUEST', 'The reservation is no longer cancelled.', 400);
    if (err.message === 'INVALID_REFUND_METHOD') return errorResponse('BAD_REQUEST', 'Invalid refund settlement method.', 400);
    if (err.message === 'BANK_DETAILS_REQUIRED') return errorResponse('BAD_REQUEST', 'Bank details are required for a bank transfer refund.', 400);
    if (err.message === 'CONFLICT') return errorResponse('CONFLICT', 'Approval request is no longer pending', 409);

    return errorResponse('INTERNAL_ERROR', 'Unexpected error processing approval', 500);
  }
}

async function executeGatewayRefund(refund: {
  providerTransactionId: string | null;
  amount: number;
  currency: string;
  reason: string;
}): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; providerRefundId?: string; message?: string }> {
  if (!refund.providerTransactionId) return { status: 'FAILED', message: 'Payment provider transaction is missing.' };
  try {
    return await new PaystackProvider().refundTransaction(refund.providerTransactionId, refund.amount, refund.currency, refund.reason);
  } catch (error: any) {
    return { status: 'PROCESSING' as const, message: error.message };
  }
}
