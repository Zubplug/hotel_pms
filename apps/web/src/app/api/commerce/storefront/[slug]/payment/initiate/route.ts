/**
 * POST /api/commerce/storefront/[slug]/payment/initiate
 *
 * Public, unauthenticated — initiates a Paystack or Flutterwave payment
 * for a PENDING_PAYMENT order.
 *
 * Reuses existing payment infrastructure:
 *   - PaystackProvider  → @/lib/payment-providers/paystack.ts
 *   - FlutterwaveProvider → @/lib/payment-providers/flutterwave.ts
 *   - decryptPaymentCredential → @/lib/payment-providers/credentials.ts
 *
 * Per-store gateway keys are stored encrypted in CommerceStore.
 * They are decrypted here at request time — never sent to the client.
 */

import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import { CommerceFlutterwaveProvider } from '@/lib/payment-providers/commerce-flutterwave';
import { decryptPaymentCredential } from '@/lib/payment-providers/credentials';
import { z } from 'zod';
import { hasPublicCommerceAccess } from '@/lib/commerce/public-access';

type Params = { params: Promise<{ slug: string }> };

const schema = z.object({
  orderRef: z.string(),
  trackingToken: z.string(),
  callbackUrl: z.string().url(),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const { orderRef, trackingToken, callbackUrl } = schema.parse(body);

    const store = await prisma.commerceStore.findUnique({
      where: { slug },
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        status: true,
        preferredGateway: true,
        paystackSecretKey: true,
        flutterwaveSecretKey: true,
        currency: true,
        name: true,
      },
    });

    if (!store || store.status !== 'ACTIVE') {
      return errorResponse('NOT_FOUND', 'Store not found', 404);
    }
    if (!(await hasPublicCommerceAccess(store.organizationId, store.propertyId))) {
      return errorResponse('STORE_UNAVAILABLE', 'Online ordering is temporarily unavailable.', 503);
    }

    const order = await prisma.commerceOrder.findFirst({
      where: { storeId: store.id, orderRef, trackingToken },
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        payment: { select: { id: true, status: true } },
      },
    });

    if (!order) return errorResponse('NOT_FOUND', 'Order not found', 404);
    if (order.status !== 'PENDING_PAYMENT') {
      return errorResponse('ALREADY_PROCESSED', 'This order has already been processed.', 409);
    }
    if (!order.payment) return errorResponse('NO_PAYMENT', 'No payment record found.', 500);

    const gateway = store.preferredGateway;
    const amount = Number(order.totalAmount);
    const currency = store.currency;
    const email = order.customer?.email ?? `${order.customer?.phone ?? 'guest'}@commerce.lodgecore.app`;

    // Unique reference — same pattern as existing payment init route
    const providerRef = `FC-${order.orderRef}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    let checkoutUrl: string;
    let resolvedRef: string = providerRef;

    if (gateway === 'PAYSTACK') {
      if (!store.paystackSecretKey) {
        return errorResponse('GATEWAY_NOT_CONFIGURED', 'Paystack is not configured for this store.', 503);
      }
      // Decrypt stored key (may be plain-text in dev, encrypted in prod)
      let secretKey: string;
      try {
        secretKey = store.paystackSecretKey.startsWith('v1.')
          ? decryptPaymentCredential(store.paystackSecretKey)
          : store.paystackSecretKey;
      } catch {
        return errorResponse('GATEWAY_NOT_CONFIGURED', 'Gateway credentials are invalid.', 503);
      }

      // Reuse PaystackProvider — same class used for hotel folio payments.
      // Now accepts an optional per-store key (updated constructor).
      const provider = new PaystackProvider(secretKey);
      const initResult = await provider.initializeTransaction({
        amount,
        currency,
        email,
        reference: providerRef,
        callbackUrl,
      });

      checkoutUrl = initResult.authorizationUrl;
      resolvedRef = initResult.providerRef;

    } else if (gateway === 'FLUTTERWAVE') {
      if (!store.flutterwaveSecretKey) {
        return errorResponse('GATEWAY_NOT_CONFIGURED', 'Flutterwave is not configured for this store.', 503);
      }
      let secretKey: string;
      try {
        secretKey = store.flutterwaveSecretKey.startsWith('v1.')
          ? decryptPaymentCredential(store.flutterwaveSecretKey)
          : store.flutterwaveSecretKey;
      } catch {
        return errorResponse('GATEWAY_NOT_CONFIGURED', 'Gateway credentials are invalid.', 503);
      }

      const provider = new CommerceFlutterwaveProvider(secretKey);
      const fwResult = await provider.initializeTransaction({
        txRef: providerRef,
        amount,
        currency,
        callbackUrl,
        customerEmail: email,
        customerName: order.customer?.name ?? 'Customer',
        customerPhone: order.customer?.phone,
        storeName: store.name,
        meta: { orderRef: order.orderRef, storeId: store.id },
      });

      checkoutUrl = fwResult.checkoutUrl;
    } else {
      return errorResponse('GATEWAY_NOT_CONFIGURED', 'No payment gateway configured.', 503);
    }

    // Store provider reference on the payment record
    await prisma.commercePayment.update({
      where: { orderId: order.id },
      data: { providerReference: resolvedRef, provider: gateway },
    });

    return successResponse({ checkoutUrl, providerReference: resolvedRef });
  } catch (err) {
    if (err instanceof Error && err.name === 'ZodError') {
      return errorResponse('VALIDATION_ERROR', 'Invalid request', 422);
    }
    console.error('[commerce/payment/initiate]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
