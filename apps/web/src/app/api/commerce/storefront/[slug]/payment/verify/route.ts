/**
 * POST /api/commerce/storefront/[slug]/payment/verify
 *
 * Webhook + redirect handler for Paystack and Flutterwave payment callbacks.
 *
 * Security:
 *   - Paystack: verifies x-paystack-signature HMAC-SHA512
 *   - Flutterwave: verifies verif-hash header against store's webhook secret
 *   - Falls back to polling the gateway's verify endpoint for redirect callbacks
 *
 * On verified payment:
 *   1. Updates CommercePayment.status = VERIFIED
 *   2. Updates CommerceOrder.status = AWAITING_RESTAURANT + paymentStatus = PAID
 *   3. Enqueues CommerceSyncEvent for offline POS
 *   4. Sends ORDER_PLACED + PAYMENT_CONFIRMED notifications to customer
 *   5. Updates customer totalSpend
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import { FlutterwaveProvider } from '@/lib/payment-providers/flutterwave';
import { getPropertyPaymentAccount, resolvePropertySecret } from '@/lib/payment-providers/property-account';
import { enqueueCommerceSyncEvent } from '@/lib/commerce/sync';
import { sendOrderNotification } from '@/lib/commerce/notifications';
import { hasPublicCommerceAccess } from '@/lib/commerce/public-access';
import { CommercePaymentAccountingService } from '@/lib/services/commerce-payment-accounting-service';
import { CommerceRefundService } from '@/lib/services/commerce-refund-service';

type Params = { params: Promise<{ slug: string }> };

type LateRefundResult = 'COMPLETED' | 'PROCESSING' | 'FAILED';

async function handleCommerceRefundWebhook(input: {
  storeId: string;
  payload: any;
  completed: boolean;
}) {
  const data = input.payload?.data ?? {};
  const reference = data.reference ?? data.transaction_reference ?? data.tx_ref;
  const providerTransactionId = data.transaction_id ?? data.transactionId ?? data.id;
  const payment = await prisma.commercePayment.findFirst({
    where: {
      storeId: input.storeId,
      OR: [
        ...(reference ? [{ providerReference: String(reference) }] : []),
        ...(providerTransactionId ? [{ metadata: { path: ['providerTransactionId'], equals: String(providerTransactionId) } }] : []),
      ],
    },
    include: { order: true },
  });
  if (!payment) return successResponse({ received: true });

  if (input.completed) {
    await prisma.$transaction([
      prisma.commercePayment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
          refundedAt: payment.refundedAt ?? new Date(),
          refundRef: data.id ? String(data.id) : undefined,
          metadata: {
            ...((payment.metadata as Record<string, unknown> | null) ?? {}),
            refundStatus: 'COMPLETED',
            providerTransactionId: providerTransactionId ? String(providerTransactionId) : undefined,
          },
        },
      }),
      prisma.commerceOrder.update({ where: { id: payment.orderId }, data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' } }),
    ]);
    await CommerceRefundService.finalizeCompletedRefund({
      paymentId: payment.id,
      actorId: payment.id,
      reason: 'Commerce gateway refund confirmed',
    });
  } else {
    await prisma.$transaction([
      prisma.commercePayment.update({
        where: { id: payment.id },
        data: { status: 'REFUND_FAILED', metadata: { ...((payment.metadata as Record<string, unknown> | null) ?? {}), refundStatus: 'FAILED', refundFailureReason: 'GATEWAY_REFUND_FAILED' } },
      }),
      prisma.commerceOrder.update({ where: { id: payment.orderId }, data: { status: 'CANCELLED', paymentStatus: 'REFUND_FAILED' } }),
    ]);
  }
  return successResponse({ received: true, refund: input.completed ? 'COMPLETED' : 'FAILED' });
}

async function refundLateCommercePayment(input: {
  account: { provider: string; secret: string | null; secretRef: string | null; currency: string };
  payment: any;
  order: any;
  webhookPayload: any;
}) : Promise<LateRefundResult> {
  const metadata = (input.payment.metadata as Record<string, unknown> | null) ?? {};
  if (metadata.refundStatus === 'COMPLETED' || input.payment.status === 'REFUNDED') return 'COMPLETED';
  if (metadata.refundStatus === 'PROCESSING' || input.payment.status === 'REFUND_PENDING') return 'PROCESSING';

  const amount = input.account.provider === 'PAYSTACK'
    ? Number(input.webhookPayload.data?.amount || 0) / 100
    : Number(input.webhookPayload.data?.amount || 0);
  const currency = String(input.webhookPayload.data?.currency || input.payment.currency).toUpperCase();
  const expectedAmount = Number(input.payment.amount);
  if (amount <= 0 || Math.abs(amount - expectedAmount) > 0.01 || currency !== String(input.payment.currency).toUpperCase()) {
    await prisma.commercePayment.update({
      where: { id: input.payment.id },
      data: {
        status: 'REFUND_FAILED',
        metadata: { ...metadata, latePayment: true, refundStatus: 'FAILED', refundFailureReason: 'AMOUNT_OR_CURRENCY_MISMATCH' },
      },
    });
    return 'FAILED';
  }

  const providerTransactionId = input.webhookPayload.data?.id;
  if (!providerTransactionId) {
    await prisma.commercePayment.update({
      where: { id: input.payment.id },
      data: { status: 'REFUND_FAILED', metadata: { ...metadata, latePayment: true, refundStatus: 'FAILED', refundFailureReason: 'MISSING_PROVIDER_TRANSACTION_ID' } },
    });
    return 'FAILED';
  }

  let secretKey: string;
  try {
    secretKey = resolvePropertySecret(
      input.account.secret,
      input.account.secretRef,
      input.account.provider === 'PAYSTACK' ? 'PAYSTACK_SECRET_KEY' : 'FLW_SECRET_KEY',
    );
  } catch (error) {
    await prisma.commercePayment.update({
      where: { id: input.payment.id },
      data: { status: 'REFUND_FAILED', metadata: { ...metadata, latePayment: true, refundStatus: 'FAILED', refundFailureReason: 'GATEWAY_NOT_CONFIGURED' } },
    });
    console.error('[commerce late payment refund] gateway configuration failed', error);
    return 'FAILED';
  }

  try {
    const provider = input.account.provider === 'PAYSTACK'
      ? new PaystackProvider(secretKey)
      : new FlutterwaveProvider(secretKey);
    const refund = await provider.refundTransaction(String(providerTransactionId), amount, currency, 'Late Food Commerce payment received after checkout expiry');
    const nextStatus = refund.status as LateRefundResult;
    await prisma.$transaction([
      prisma.commercePayment.update({
        where: { id: input.payment.id },
        data: {
          status: nextStatus === 'COMPLETED' ? 'REFUNDED' : nextStatus === 'PROCESSING' ? 'REFUND_PENDING' : 'REFUND_FAILED',
          refundedAt: nextStatus === 'COMPLETED' ? new Date() : undefined,
          refundRef: refund.providerRefundId ?? undefined,
          metadata: { ...metadata, latePayment: true, refundStatus: nextStatus, providerTransactionId: String(providerTransactionId), refundMessage: refund.message ?? null },
        },
      }),
      prisma.commerceOrder.update({
        where: { id: input.order.id },
        data: { paymentStatus: nextStatus === 'COMPLETED' ? 'REFUNDED' : nextStatus === 'PROCESSING' ? 'REFUND_PENDING' : 'REFUND_FAILED' },
      }),
    ]);
    if (nextStatus === 'COMPLETED') {
      await CommerceRefundService.finalizeCompletedRefund({
        paymentId: input.payment.id,
        actorId: input.payment.id,
        reason: 'Late Commerce payment refunded after checkout expiry',
      });
    }
    return nextStatus;
  } catch (error) {
    await prisma.commercePayment.update({
      where: { id: input.payment.id },
      data: { status: 'REFUND_FAILED', metadata: { ...metadata, latePayment: true, refundStatus: 'FAILED', refundFailureReason: error instanceof Error ? error.message : 'REFUND_ERROR' } },
    }).catch(() => null);
    console.error('[commerce late payment refund] provider refund failed', error);
    return 'FAILED';
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;

    const store = await prisma.commerceStore.findUnique({
      where: { slug },
      select: {
        id: true,
        organizationId: true,
        targetOutletId: true,
        propertyId: true,
        status: true,
        notifySmsEnabled: true,
        notifyEmailEnabled: true,
      },
    });

    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);
    if (!(await hasPublicCommerceAccess(store.organizationId, store.propertyId))) {
      return errorResponse('STORE_UNAVAILABLE', 'Online ordering is temporarily unavailable.', 503);
    }

    const rawBody = await req.text();
    const account = store.propertyId ? await getPropertyPaymentAccount(store.propertyId) : null;
    if (!account) return errorResponse('GATEWAY_NOT_CONFIGURED', 'The property payment account is not configured.', 503);
    const gateway = account.provider;

    let providerReference: string | null = null;
    let eventType: string | null = null;
    let webhookPayload: any = null;

    // -------------------------------------------------------------------------
    // Paystack signature verification
    // -------------------------------------------------------------------------
    if (gateway === 'PAYSTACK') {
      const signature = req.headers.get('x-paystack-signature');
      if (!signature) {
        return errorResponse('UNAUTHORIZED', 'Invalid webhook signature', 401);
      }

      let secretKey: string;
      try {
        secretKey = resolvePropertySecret(account.webhookSecret, account.webhookSecretRef, 'PAYSTACK_SECRET_KEY');
      } catch {
        return errorResponse('GATEWAY_NOT_CONFIGURED', 'Gateway credentials are invalid.', 503);
      }

      const provider = new PaystackProvider(secretKey);
      if (!provider.validateWebhookSignature(rawBody, signature)) {
        return errorResponse('UNAUTHORIZED', 'Invalid webhook signature', 401);
      }

      webhookPayload = JSON.parse(rawBody);
      eventType = webhookPayload.event;
      providerReference = webhookPayload.data?.reference ?? null;

      if (eventType === 'refund.processed') {
        return handleCommerceRefundWebhook({ storeId: store.id, payload: webhookPayload, completed: true });
      }
      if (eventType === 'refund.failed') {
        return handleCommerceRefundWebhook({ storeId: store.id, payload: webhookPayload, completed: false });
      }
      if (eventType !== 'charge.success') {
        return successResponse({ received: true });
      }
    }

    // -------------------------------------------------------------------------
    // Flutterwave signature verification
    // -------------------------------------------------------------------------
    else if (gateway === 'FLUTTERWAVE') {
      const hash = req.headers.get('verif-hash');
      let webhookSecret: string;
      try {
        webhookSecret = resolvePropertySecret(account.webhookSecret, account.webhookSecretRef, 'FLW_WEBHOOK_SECRET_HASH');
      } catch {
        return errorResponse('GATEWAY_NOT_CONFIGURED', 'Gateway credentials are invalid.', 503);
      }
      if (!hash || hash !== webhookSecret) {
        return errorResponse('UNAUTHORIZED', 'Invalid webhook signature', 401);
      }

      webhookPayload = JSON.parse(rawBody);
      eventType = webhookPayload.event;
      providerReference = webhookPayload.data?.tx_ref ?? null;

      if (eventType === 'refund.completed' || eventType === 'refund.processed') {
        return handleCommerceRefundWebhook({ storeId: store.id, payload: webhookPayload, completed: true });
      }
      if (eventType === 'refund.failed' || eventType === 'refund.cancelled') {
        return handleCommerceRefundWebhook({ storeId: store.id, payload: webhookPayload, completed: false });
      }
      if (eventType !== 'charge.completed') {
        return successResponse({ received: true });
      }
    } else {
      return errorResponse('GATEWAY_NOT_CONFIGURED', 'No payment gateway configured.', 503);
    }

    if (!providerReference) {
      return errorResponse('MISSING_REFERENCE', 'No payment reference in webhook payload.', 422);
    }

    // Find the payment record
    const payment = await prisma.commercePayment.findFirst({
      where: { storeId: store.id, providerReference },
      include: {
        order: {
          include: {
            customer: { select: { id: true, name: true, phone: true, email: true } },
            items: true,
          },
        },
      },
    });

    if (!payment) {
      // Unknown reference — may be a duplicate webhook. Acknowledge safely.
      return successResponse({ received: true });
    }

    if (payment.status === 'VERIFIED') {
      // Already processed — idempotent acknowledgement
      return successResponse({ received: true, alreadyProcessed: true });
    }
    if (payment.status !== 'PENDING' && !['EXPIRED', 'REFUND_PENDING', 'REFUND_FAILED'].includes(payment.status)) {
      // Failed/expired payments are terminal and must never be promoted to the
      // POS by a duplicate or delayed gateway callback.
      return successResponse({ received: true, alreadyProcessed: true });
    }

    const order = payment.order;

    // Claim the payment window and update the payment atomically. The expiry
    // job uses the same conditional state transition, so an expired order can
    // never be promoted to the POS by a late webhook.
    const now = new Date();
    const paymentResult = await prisma.$transaction(async (tx) => {
      const claimed = await tx.commerceOrder.updateMany({
        where: {
          id: order.id,
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING',
          OR: [{ paymentExpiresAt: null }, { paymentExpiresAt: { gt: now } }],
        },
        data: {
          status: 'AWAITING_RESTAURANT',
          paymentStatus: 'PAID',
          posSyncStatus: store.targetOutletId ? 'QUEUED' : 'PENDING',
        },
      });

      if (claimed.count !== 1) return { expired: true };

      await tx.commercePayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'VERIFIED',
          verifiedAt: now,
          metadata: {
            ...((payment.metadata as Record<string, unknown> | null) ?? {}),
            providerTransactionId: String(webhookPayload?.data?.id ?? providerReference),
            verifiedProviderReference: providerReference,
          },
        },
      });

      // Post the online settlement inside the same transaction as payment
      // verification. If chart-of-accounts configuration is incomplete, the
      // whole verification rolls back and the gateway can retry safely.
      const property = store.propertyId
        ? await tx.property.findUnique({ where: { id: store.propertyId }, select: { businessDate: true } })
        : null;
      if (!property || !store.propertyId || !property.businessDate) {
        throw new Error('Commerce payment property is not configured for accounting.');
      }
      await CommercePaymentAccountingService.processPaymentAccounting({
        tx,
        paymentId: payment.id,
        orderId: order.id,
        propertyId: store.propertyId,
        organizationId: store.organizationId,
        targetOutletId: store.targetOutletId,
        paymentMethod: 'PAYMENT_GATEWAY',
        amount: Number(payment.amount),
        businessDate: property.businessDate,
      });

      if (order.customerId) {
        await tx.commerceCustomer.update({
          where: { id: order.customerId },
          data: { totalSpend: { increment: Number(order.totalAmount) } },
        });
      }
      return { expired: false };
    });

    if (paymentResult.expired) {
      // A provider callback can arrive after the checkout window. Keep the
      // order cancelled and acknowledge the callback so the provider does not
      // retry it indefinitely. Reconciliation can handle any provider-side
      // capture separately; it must never reach the kitchen or bar.
      await prisma.$transaction([
        prisma.commerceOrder.updateMany({
          where: { id: order.id, status: 'PENDING_PAYMENT', paymentStatus: 'PENDING' },
          data: { status: 'CANCELLED', paymentStatus: 'EXPIRED', posSyncStatus: 'FAILED' },
        }),
        prisma.commercePayment.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        }),
      ]);
      const refundStatus = await refundLateCommercePayment({ account, payment, order, webhookPayload });
      return successResponse({ received: true, expired: true, refundStatus, orderRef: order.orderRef });
    }

    // Enqueue CommerceSyncEvent for POS if outlet is linked
    if (store.targetOutletId) {
      await enqueueCommerceSyncEvent({
        order: { ...order, payment },
        store,
        idempotencyKey: `payment-verified-${order.id}`,
      });
    }

    // Send notifications
    if (order.customer) {
      await sendOrderNotification({
        orderId: order.id,
        storeId: store.id,
        event: 'PAYMENT_CONFIRMED',
        customer: {
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email ?? undefined,
        },
        store: { notifySmsEnabled: store.notifySmsEnabled, notifyEmailEnabled: store.notifyEmailEnabled },
      });
    }

    return successResponse({ received: true, orderRef: order.orderRef });
  } catch (err) {
    console.error('[commerce/payment/verify]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
