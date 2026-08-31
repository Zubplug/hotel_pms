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
    if (!['CASHIER', 'FINANCE_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Finance settlement access required', 403);
    const body = await req.json();
    const reference = String(body.reference || '').trim();
    if (!reference) return errorResponse('BAD_REQUEST', 'A bank transfer reference is required', 400);
    const { id } = await params;
    const result = await prisma.$transaction(async tx => {
      const request = await tx.refundRequest.findUnique({ where: { id }, include: { payment: true, folio: true } });
      if (!request) throw new Error('NOT_FOUND');
      if (!user.allowedProperties.includes(request.propertyId)) throw new Error('FORBIDDEN');
      if (await isNightAuditTransactionLocked(request.propertyId)) throw new Error('NIGHT_AUDIT_IN_PROGRESS');
      if (request.approvedMethod !== 'BANK_TRANSFER' || request.status !== 'APPROVED') throw new Error('CONFLICT');
      const amount = Number(request.approvedAmount || request.requestedAmount);
      await applyRefundToFolio(tx, request, amount, user.id);
      const refund = await tx.refund.create({ data: { refundRequestId: request.id, paymentId: request.paymentId, folioId: request.folioId, propertyId: request.propertyId, amount, currency: request.currency, method: 'BANK_TRANSFER', reason: request.reason, authorizedBy: user.id, providerRefundId: `bank-transfer:${reference}`, status: 'COMPLETED', idempotencyKey: `refund-request:${request.id}` } });
      await tx.folioItem.create({ data: { folioId: request.folioId, businessDate: (await tx.property.findUnique({ where: { id: request.propertyId }, select: { businessDate: true } }))?.businessDate || new Date(), type: 'REFUND', source: 'MANUAL', description: `Bank transfer refund ${reference}`, quantity: 1, unitAmount: amount, amount, currency: request.currency, baseAmount: amount, postedBy: user.id } });
      const refunded = await tx.refund.aggregate({ where: { paymentId: request.paymentId, status: { not: 'FAILED' } }, _sum: { amount: true } });
      await tx.payment.update({ where: { id: request.paymentId }, data: { status: Number(refunded._sum.amount || 0) >= Number(request.payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
      await tx.refundRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED' } });
      const property = await tx.property.findUnique({ where: { id: request.propertyId } });
      await tx.auditLog.create({ data: { organizationId: property?.organizationId || '', propertyId: request.propertyId, userId: user.id, action: 'SETTLE_BANK_REFUND', resource: 'RefundRequest', resourceId: request.id, newValue: { amount, refundId: refund.id, reference }, ipAddress: req.headers.get('x-forwarded-for') || '', userAgent: req.headers.get('user-agent') || '', requestId: crypto.randomUUID() } });
      return refund;
    });
    return successResponse({ status: 'COMPLETED', refundId: result.id, refundRequestId: id }, 200);
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Refund request not found', 404);
    if (error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Access denied', 403);
    if (error.message === 'CONFLICT') return errorResponse('CONFLICT', 'Bank refund is no longer awaiting settlement', 409);
    if (error.message === 'NIGHT_AUDIT_IN_PROGRESS') return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Night audit cutover is in progress. Refund settlement resumes after the new business date is active.', 409);
    if (error.message === 'REDUCED_STAY_METADATA_MISSING' || error.message === 'REDUCED_STAY_CHARGES_UNAVAILABLE' || error.message === 'REDUCED_STAY_CHARGES_CHANGED') return errorResponse('CONFLICT', 'The unused room nights changed; review this reduced-stay refund before settling it.', 409);
    console.error('[Bank Refund Settlement]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to settle bank refund', 500);
  }
}
