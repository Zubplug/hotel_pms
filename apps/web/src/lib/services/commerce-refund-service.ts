import prisma from '@hotel-pms/db';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import { FlutterwaveProvider } from '@/lib/payment-providers/flutterwave';
import { getPropertyPaymentAccount, resolvePropertySecret } from '@/lib/payment-providers/property-account';
import { GeneralLedgerService } from './general-ledger-service';

type RefundResult = 'COMPLETED' | 'PROCESSING' | 'FAILED' | 'NOT_REQUIRED' | 'ALREADY_PROCESSED';

type CommerceRefundInput = {
  orderId: string;
  actorId: string;
  reason: string;
  /** Used by the late-webhook path, where the provider transaction is trusted
   * from the verified gateway payload rather than the stored payment row. */
  providerTransactionId?: string;
};

function paymentStatusFor(result: RefundResult) {
  return result === 'COMPLETED' ? 'REFUNDED' : result === 'PROCESSING' ? 'REFUND_PENDING' : 'REFUND_FAILED';
}

/**
 * Refunds a Commerce payment and reverses its original Commerce settlement.
 *
 * The gateway call is deliberately outside the database transaction. A
 * conditional state claim prevents concurrent cancellation handlers from
 * issuing two refunds; the final transaction atomically records the provider
 * result and the GL reversal.
 */
export class CommerceRefundService {
  static async refundOrder(input: CommerceRefundInput): Promise<RefundResult> {
    const order = await prisma.commerceOrder.findUnique({
      where: { id: input.orderId },
      include: {
        store: { select: { id: true, propertyId: true } },
        payment: true,
      },
    });
    if (!order?.payment) return 'NOT_REQUIRED';

    const payment = order.payment;
    if (payment.status === 'REFUNDED') {
      if (payment.refundAccountingStatus === 'FAILED') {
        await this.finalizeCompletedRefund({ paymentId: payment.id, actorId: input.actorId, reason: input.reason });
        return 'COMPLETED';
      }
      return 'ALREADY_PROCESSED';
    }
    if (payment.status === 'REFUND_PENDING') return 'PROCESSING';
    if (!['VERIFIED', 'REFUND_FAILED'].includes(payment.status)) return 'NOT_REQUIRED';
    if (!order.store.propertyId) throw new Error('Commerce store is not linked to a property.');

    const account = await getPropertyPaymentAccount(order.store.propertyId);
    if (!account) throw new Error('The property payment account is not configured.');
    const secret = resolvePropertySecret(
      account.secret,
      account.secretRef,
      account.provider === 'PAYSTACK' ? 'PAYSTACK_SECRET_KEY' : 'FLW_SECRET_KEY',
    );
    const providerTransactionId = input.providerTransactionId
      ?? ((payment.metadata as Record<string, unknown> | null)?.providerTransactionId as string | undefined)
      ?? payment.providerReference;
    if (!providerTransactionId) throw new Error('The payment has no provider transaction reference.');

    const claimed = await prisma.commercePayment.updateMany({
      where: { id: payment.id, status: { in: ['VERIFIED', 'REFUND_FAILED'] } },
      data: {
        status: 'REFUND_PENDING',
        metadata: {
          ...((payment.metadata as Record<string, unknown> | null) ?? {}),
          refundStatus: 'PROCESSING',
          refundReason: input.reason,
          providerTransactionId: String(providerTransactionId),
          refundInitiatedAt: new Date().toISOString(),
        },
      },
    });
    if (claimed.count !== 1) {
      const current = await prisma.commercePayment.findUnique({ where: { id: payment.id }, select: { status: true } });
      return current?.status === 'REFUNDED' ? 'ALREADY_PROCESSED' : 'PROCESSING';
    }
    await prisma.commerceOrder.update({ where: { id: order.id }, data: { paymentStatus: 'REFUND_PENDING' } });

    let gatewayResult: { status: 'COMPLETED' | 'PROCESSING' | 'FAILED'; providerRefundId?: string; message?: string };
    try {
      const provider = account.provider === 'PAYSTACK'
        ? new PaystackProvider(secret)
        : new FlutterwaveProvider(secret);
      gatewayResult = await provider.refundTransaction(
        String(providerTransactionId),
        Number(payment.amount),
        payment.currency,
        input.reason,
      );
    } catch (error) {
      gatewayResult = {
        status: 'FAILED',
        message: error instanceof Error ? error.message : 'Gateway refund failed',
      };
    }

    const result = gatewayResult.status as RefundResult;
    const nextPaymentStatus = paymentStatusFor(result);
    const metadata = {
      ...((payment.metadata as Record<string, unknown> | null) ?? {}),
      refundStatus: result,
      providerTransactionId: String(providerTransactionId),
      refundMessage: gatewayResult.message ?? null,
    };

    if (result !== 'COMPLETED') {
      await prisma.$transaction([
        prisma.commercePayment.update({
          where: { id: payment.id },
          data: { status: nextPaymentStatus, refundRef: gatewayResult.providerRefundId ?? undefined, metadata },
        }),
        prisma.commerceOrder.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', paymentStatus: nextPaymentStatus },
        }),
      ]);
      return result;
    }

    try {
      await prisma.$transaction(async (tx) => {
      const current = await tx.commercePayment.findUnique({
        where: { id: payment.id },
        select: { accountingStatus: true, accountingJournalId: true, refundAccountingStatus: true, refundAccountingJournalId: true },
      });
      const property = await tx.property.findUnique({ where: { id: order.store.propertyId! }, select: { businessDate: true, organizationId: true } });
      if (!property || !property.businessDate) throw new Error('Commerce property business date is not configured for refund accounting.');

      let refundJournalId = current?.refundAccountingJournalId ?? null;
      if (current?.accountingStatus === 'POSTED' && current.accountingJournalId && current.refundAccountingStatus !== 'POSTED') {
        const reversal = await GeneralLedgerService.reverseJournal({
          userId: input.actorId,
          propertyIds: [order.store.propertyId!],
          organizationId: property.organizationId,
          role: 'SYSTEM',
          permissions: [],
          outletIds: [],
        } as any, current.accountingJournalId, property.businessDate, `Commerce order ${order.orderRef} refunded: ${input.reason}`, tx);
        refundJournalId = reversal.id;
      }

      await tx.commercePayment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
          refundRef: gatewayResult.providerRefundId ?? undefined,
          metadata,
          refundAccountingStatus: current?.accountingStatus === 'POSTED' ? 'POSTED' : 'NONE',
          refundAccountingJournalId: refundJournalId,
          refundAccountingPostedAt: current?.accountingStatus === 'POSTED' ? new Date() : null,
          refundAccountingFailureReason: null,
        },
      });
      await tx.commerceOrder.update({ where: { id: order.id }, data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' } });
      });
    } catch (error) {
      // The gateway has already confirmed the refund. Preserve that fact and
      // leave a durable accounting failure for a manager retry; never turn a
      // successful customer refund into a false REFUND_FAILED state.
      await prisma.commercePayment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
          refundRef: gatewayResult.providerRefundId ?? undefined,
          metadata,
          refundAccountingStatus: 'FAILED',
          refundAccountingFailureReason: error instanceof Error ? error.message : 'Refund reversal posting failed',
        },
      });
      await prisma.commerceOrder.update({ where: { id: order.id }, data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' } });
    }
    return 'COMPLETED';
  }

  /** Completes the accounting side when a gateway callback confirmed a refund
   * that was initiated by another path (for example a late payment webhook). */
  static async finalizeCompletedRefund(input: { paymentId: string; actorId: string; reason: string }) {
    try {
      await prisma.$transaction(async (tx) => {
      const payment = await tx.commercePayment.findUnique({
        where: { id: input.paymentId },
        include: { order: { include: { store: true } } },
      });
      if (!payment || payment.refundAccountingStatus === 'POSTED') return;
      if (payment.accountingStatus !== 'POSTED' || !payment.accountingJournalId) return;
      const propertyId = payment.order.store.propertyId;
      if (!propertyId) throw new Error('Commerce store is not linked to a property.');
      const property = await tx.property.findUnique({ where: { id: propertyId }, select: { businessDate: true, organizationId: true } });
      if (!property || !property.businessDate) throw new Error('Commerce property business date is not configured for refund accounting.');
      const reversal = await GeneralLedgerService.reverseJournal({
        userId: input.actorId,
        propertyIds: [propertyId],
        organizationId: property.organizationId,
        role: 'SYSTEM',
        permissions: [],
        outletIds: [],
      } as any, payment.accountingJournalId, property.businessDate, input.reason, tx);
      await tx.commercePayment.update({
        where: { id: payment.id },
        data: {
          refundAccountingStatus: 'POSTED',
          refundAccountingJournalId: reversal.id,
          refundAccountingPostedAt: new Date(),
          refundAccountingFailureReason: null,
        },
      });
      });
    } catch (error) {
      await prisma.commercePayment.update({
        where: { id: input.paymentId },
        data: {
          refundAccountingStatus: 'FAILED',
          refundAccountingFailureReason: error instanceof Error ? error.message : 'Refund reversal posting failed',
        },
      }).catch(() => null);
      console.error('[commerce refund accounting]', error);
    }
  }
}
