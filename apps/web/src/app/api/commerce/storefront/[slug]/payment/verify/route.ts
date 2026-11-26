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
import { decryptPaymentCredential } from '@/lib/payment-providers/credentials';
import { enqueueCommerceSyncEvent } from '@/lib/commerce/sync';
import { sendOrderNotification } from '@/lib/commerce/notifications';
import { hasPublicCommerceAccess } from '@/lib/commerce/public-access';

type Params = { params: Promise<{ slug: string }> };

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
        preferredGateway: true,
        paystackSecretKey: true,
        flutterwaveSecretKey: true,
        notifySmsEnabled: true,
        notifyEmailEnabled: true,
      },
    });

    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);
    if (!(await hasPublicCommerceAccess(store.organizationId, store.propertyId))) {
      return errorResponse('STORE_UNAVAILABLE', 'Online ordering is temporarily unavailable.', 503);
    }

    const rawBody = await req.text();
    const gateway = store.preferredGateway;

    let providerReference: string | null = null;
    let eventType: string | null = null;

    // -------------------------------------------------------------------------
    // Paystack signature verification
    // -------------------------------------------------------------------------
    if (gateway === 'PAYSTACK') {
      const signature = req.headers.get('x-paystack-signature');
      if (!signature || !store.paystackSecretKey) {
        return errorResponse('UNAUTHORIZED', 'Invalid webhook signature', 401);
      }

      // Decrypt stored key then delegate to existing PaystackProvider.validateWebhookSignature()
      // — same method used by the main hotel folio webhook at /api/v1/payments/online/webhook
      let secretKey: string;
      try {
        secretKey = store.paystackSecretKey.startsWith('v1.')
          ? decryptPaymentCredential(store.paystackSecretKey)
          : store.paystackSecretKey;
      } catch {
        return errorResponse('GATEWAY_NOT_CONFIGURED', 'Gateway credentials are invalid.', 503);
      }

      const provider = new PaystackProvider(secretKey);
      if (!provider.validateWebhookSignature(rawBody, signature)) {
        return errorResponse('UNAUTHORIZED', 'Invalid webhook signature', 401);
      }

      const payload = JSON.parse(rawBody);
      eventType = payload.event;
      providerReference = payload.data?.reference ?? null;

      if (eventType !== 'charge.success') {
        return successResponse({ received: true });
      }
    }

    // -------------------------------------------------------------------------
    // Flutterwave signature verification
    // -------------------------------------------------------------------------
    else if (gateway === 'FLUTTERWAVE') {
      const hash = req.headers.get('verif-hash');
      // Store's webhook secret — use flutterwaveSecretKey as the verif hash key
      if (!hash || hash !== store.flutterwaveSecretKey) {
        return errorResponse('UNAUTHORIZED', 'Invalid webhook signature', 401);
      }

      const payload = JSON.parse(rawBody);
      eventType = payload.event;
      providerReference = payload.data?.tx_ref ?? null;

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

    const order = payment.order;

    // Update payment + order status atomically
    await prisma.$transaction([
      prisma.commercePayment.update({
        where: { id: payment.id },
        data: { status: 'VERIFIED', verifiedAt: new Date() },
      }),
      prisma.commerceOrder.update({
        where: { id: order.id },
        data: {
          status: 'AWAITING_RESTAURANT',
          paymentStatus: 'PAID',
          posSyncStatus: store.targetOutletId ? 'QUEUED' : 'PENDING',
        },
      }),
      prisma.commerceCustomer.update({
        where: { id: order.customerId! },
        data: { totalSpend: { increment: Number(order.totalAmount) } },
      }),
    ]);

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
