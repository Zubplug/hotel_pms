import prisma from '@hotel-pms/db';
import crypto from 'node:crypto';
import { sendBookingRefundCompletedEmail } from '@/lib/email/booking-emails';
import { NotificationEngine } from '@/lib/notification-engine';

const FINAL_STATUSES = new Set(['completed-bank-transfer', 'completed-momo', 'completed-mpgs', 'completed-offline', 'completed-preauth', 'successful', 'succeeded']);
const FAILED_STATUSES = new Set(['failed', 'cancelled', 'canceled']);

export function normalizeFlutterwaveRefundStatus(value: string): 'PROCESSING' | 'COMPLETED' | 'FAILED' {
  const status = value.trim().toLowerCase();
  if (FINAL_STATUSES.has(status)) return 'COMPLETED';
  if (FAILED_STATUSES.has(status)) return 'FAILED';
  return 'PROCESSING';
}

/**
 * Applies a provider refund update exactly once. The provider callback may be
 * delivered more than once, and `completed` is deliberately treated as
 * processing because Flutterwave documents it as pending final disbursement.
 */
export async function reconcileFlutterwaveRefund(input: {
  providerRefundId: string;
  status: string;
  source: 'WEBHOOK' | 'RECONCILIATION';
  payload?: unknown;
}) {
  const nextStatus = normalizeFlutterwaveRefundStatus(input.status);
  const refund = await prisma.refund.findFirst({
    where: { providerRefundId: input.providerRefundId },
    include: { refundRequest: { include: { reservation: { include: { primaryGuest: true, property: { select: { name: true } } } } } }, payment: true, bookingPaymentTransaction: true, property: { select: { organizationId: true, businessDate: true } } },
  });
  if (!refund) return { matched: false, status: nextStatus };

  if (refund.status === 'COMPLETED' && nextStatus !== 'COMPLETED') return { matched: true, status: 'COMPLETED', idempotent: true };
  if (refund.status === 'FAILED' && nextStatus === 'PROCESSING') return { matched: true, status: 'FAILED', idempotent: true };
  if (refund.status === nextStatus) return { matched: true, status: nextStatus, idempotent: true };

  await prisma.$transaction(async (tx: any) => {
    const current = await tx.refund.findUnique({ where: { id: refund.id }, include: { refundRequest: true, payment: true, bookingPaymentTransaction: true } });
    if (!current || current.status === 'COMPLETED' || current.status === 'FAILED' && nextStatus === 'PROCESSING') return;

    if (nextStatus === 'COMPLETED') {
      if (current.folioId) {
        const folio = await tx.folio.findUnique({ where: { id: current.folioId } });
        if (!folio) throw new Error('FOLIO_NOT_FOUND');
        const updated = await tx.folio.updateMany({
          where: { id: folio.id, version: folio.version },
          data: { version: { increment: 1 }, totalPayments: { decrement: Number(current.amount) }, balance: { increment: Number(current.amount) } },
        });
        if (updated.count !== 1) throw new Error('FOLIO_CONFLICT');
        await tx.folioItem.create({
          data: {
            folioId: folio.id,
            businessDate: refund.property.businessDate || new Date(),
            type: 'REFUND',
            source: 'MANUAL',
            description: `Flutterwave refund ${input.providerRefundId}`,
            quantity: 1,
            unitAmount: Number(current.amount),
            amount: Number(current.amount),
            currency: current.currency,
            baseAmount: Number(current.amount),
            postedBy: current.authorizedBy,
          },
        });
      }
      if (current.paymentId && current.payment) {
        const refunded = await tx.refund.aggregate({ where: { paymentId: current.paymentId, status: { not: 'FAILED' } }, _sum: { amount: true } });
        await tx.payment.update({ where: { id: current.paymentId }, data: { status: Number(refunded._sum.amount || 0) >= Number(current.payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
      }
      if (current.refundRequestId) await tx.refundRequest.update({ where: { id: current.refundRequestId }, data: { status: 'COMPLETED' } });
    } else if (current.refundRequestId) {
      await tx.refundRequest.update({ where: { id: current.refundRequestId }, data: { status: nextStatus } });
    }

    await tx.refund.update({ where: { id: current.id }, data: { status: nextStatus } });
    if (current.bookingPaymentTransaction) {
      const metadata = (current.bookingPaymentTransaction.metadata as Record<string, unknown> | null) ?? {};
      await tx.bookingPaymentTransaction.update({
        where: { id: current.bookingPaymentTransaction.id },
        data: {
          status: nextStatus === 'COMPLETED' ? 'REFUNDED' : 'SUCCESSFUL_LATE',
          metadata: { ...metadata, latePayment: true, refundStatus: nextStatus, providerRefundId: input.providerRefundId },
        },
      });
    }
    await tx.auditLog.create({
      data: {
        organizationId: refund.property.organizationId,
        propertyId: refund.propertyId,
        userId: current.authorizedBy,
        action: 'FLUTTERWAVE_REFUND_RECONCILED',
        resource: 'Refund',
        resourceId: current.id,
        newValue: { status: nextStatus, providerRefundId: input.providerRefundId, source: input.source, payload: input.payload ?? null },
        ipAddress: 'provider',
        userAgent: `Flutterwave ${input.source}`,
        requestId: crypto.randomUUID(),
      },
    });
  });

  const reservation = refund.refundRequest?.reservation;
  if (nextStatus === 'COMPLETED' && reservation?.primaryGuest?.email) {
    await sendBookingRefundCompletedEmail({
      to: reservation.primaryGuest.email,
      propertyName: reservation.property.name,
      confirmationNumber: reservation.confirmationNumber,
      amount: Number(refund.amount),
      currency: refund.currency,
      method: refund.method,
    }).catch((error) => console.error('[Flutterwave refund] completion email failed', error));
  }
  if (nextStatus === 'FAILED' && refund.bookingPaymentTransaction) {
    await NotificationEngine.emit({
      type: 'LATE_PAYMENT_REFUND_FAILED',
      organizationId: refund.property.organizationId,
      propertyId: refund.propertyId,
      entityType: 'refund',
      entityId: refund.id,
      idempotencyKey: `late-payment-refund-failed:${refund.id}`,
      metadata: { amount: Number(refund.amount), currency: refund.currency, providerRefundId: input.providerRefundId },
    });
  }
  return { matched: true, status: nextStatus, idempotent: false };
}
