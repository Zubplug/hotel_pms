import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { applyRefundToFolio } from '@/lib/refunds/settle-refund';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['CASHIER', 'FRONT_DESK_MANAGER', 'MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Cash-office access required', 403);
    }

    const { id } = await params;
    const result = await prisma.$transaction(async tx => {
      const request = await tx.refundRequest.findUnique({ where: { id }, include: { payment: true, folio: true } });
      if (!request) throw new Error('NOT_FOUND');
      if (!user.isSuperAdmin && !user.allowedProperties.includes(request.propertyId)) throw new Error('FORBIDDEN');
      if (await isNightAuditTransactionLocked(request.propertyId)) throw new Error('NIGHT_AUDIT_IN_PROGRESS');
      if (request.approvedMethod !== 'CASH' || request.status !== 'APPROVED') throw new Error('CONFLICT');

      const amount = Number(request.approvedAmount || request.requestedAmount);
      await applyRefundToFolio(tx, request, amount, user.id);

      const refund = await tx.refund.create({ data: {
        refundRequestId: request.id,
        paymentId: request.paymentId,
        folioId: request.folioId,
        propertyId: request.propertyId,
        amount,
        currency: request.currency,
        method: 'CASH',
        reason: request.reason,
        authorizedBy: user.id,
        providerRefundId: `cash-office:${request.id}`,
        status: 'COMPLETED',
        idempotencyKey: `refund-request:${request.id}`
      } });
      const staff = await tx.staff.findFirst({ where: { userId: user.id } });
      const activeSession = staff ? await tx.frontdeskSession.findFirst({ where: { propertyId: request.propertyId, staffId: staff.id, status: 'OPEN' } }) : null;
      if (!activeSession || !staff) throw new Error('SHIFT_NOT_OPEN');
      if (activeSession && staff) {
        await tx.posCashMovement.create({
          data: {
            propertyId: request.propertyId,
            deviceId: 'FRONT_DESK',
            frontdeskSessionId: activeSession.id,
            userId: staff.id,
            amount,
            currency: request.currency,
            type: 'REFUND',
            sourceAccountId: activeSession.cashAccountId,
            destinationAccountId: activeSession.cashAccountId,
            reasonCode: 'CASH_REFUND',
            receiptReference: `refund:${request.id}`,
            operationId: `FD-REFUND-${request.id}`,
            businessDate: activeSession.businessDate
          }
        });
      }
      await tx.folioItem.create({ data: { folioId: request.folioId, businessDate: (await tx.property.findUnique({ where: { id: request.propertyId }, select: { businessDate: true } }))?.businessDate || new Date(), type: 'REFUND', source: 'MANUAL', description: `Cash refund request ${request.id}`, quantity: 1, unitAmount: amount, amount, currency: request.currency, baseAmount: amount, postedBy: user.id } });
      const totalRefunded = await tx.refund.aggregate({ where: { paymentId: request.paymentId, status: { not: 'FAILED' } }, _sum: { amount: true } });
      await tx.payment.update({ where: { id: request.paymentId }, data: { status: Number(totalRefunded._sum.amount || 0) >= Number(request.payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
      await tx.refundRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED' } });
      const property = await tx.property.findUnique({ where: { id: request.propertyId } });
      await tx.auditLog.create({ data: { organizationId: property?.organizationId || '', propertyId: request.propertyId, userId: user.id, action: 'SETTLE_CASH_REFUND', resource: 'RefundRequest', resourceId: request.id, newValue: { amount, refundId: refund.id }, ipAddress: req.headers.get('x-forwarded-for') || '', userAgent: req.headers.get('user-agent') || '', requestId: crypto.randomUUID() } });
      return refund;
    });
    return successResponse({ status: 'COMPLETED', refundId: result.id, refundRequestId: id }, 200);
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Refund request not found', 404);
    if (error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Access denied', 403);
    if (error.message === 'CONFLICT') return errorResponse('CONFLICT', 'Cash refund is no longer awaiting settlement', 409);
    if (error.message === 'REDUCED_STAY_METADATA_MISSING' || error.message === 'REDUCED_STAY_CHARGES_UNAVAILABLE' || error.message === 'REDUCED_STAY_CHARGES_CHANGED') return errorResponse('CONFLICT', 'The unused room nights changed; review this reduced-stay refund before settling it.', 409);
    if (error.message === 'SHIFT_NOT_OPEN') return errorResponse('CONFLICT', 'Open your front desk cashier session before settling a cash refund.', 409);
    if (error.message === 'NIGHT_AUDIT_IN_PROGRESS') return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Night audit cutover is in progress. Refund settlement resumes after the new business date is active.', 409);
    console.error('[Cash Refund Settlement]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to settle cash refund', 500);
  }
}
