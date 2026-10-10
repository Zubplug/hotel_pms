import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma, { Prisma } from '@hotel-pms/db';
import { subscriptionScope, verifyFlutterwaveLegacyWebhook, verifyFlutterwaveTransaction, verifyFlutterwaveWebhook } from '@hotel-pms/db';

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

function nextPeriod(interval: string, from: Date) {
  const end = new Date(from);
  if (interval === 'year') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

function metadataValue(meta: unknown, key: string) {
  return meta && typeof meta === 'object' && !Array.isArray(meta) && typeof (meta as Record<string, unknown>)[key] === 'string'
    ? String((meta as Record<string, unknown>)[key])
    : '';
}

function createPublishableKey() {
  return `pk_live_${crypto.randomBytes(24).toString('base64url')}`;
}

function websiteOrigins(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const domain = (metadata as Record<string, unknown>).domain;
  if (typeof domain !== 'string' || !domain.trim()) return [];
  const hostname = domain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  return hostname ? [`https://${hostname}`, `https://www.${hostname}`] : [];
}

async function reconcileEntitlements(tx: Prisma.TransactionClient, organizationId: string) {
  const graceCutoff = new Date(Date.now() - GRACE_PERIOD_MS);
  const subscriptions = await tx.subscription.findMany({
    where: { organizationId, OR: [{ status: { in: ['ACTIVE', 'TRIALING'] } }, { status: 'PAST_DUE', OR: [{ pastDueSince: null }, { pastDueSince: { gt: graceCutoff } }] }] },
    include: { items: { include: { price: { include: { product: true } } } } },
  });
  const active = new Map<string, { productCode: string; propertyId: string | null; expiresAt: Date; startsAt: Date; quantity: number | null }>();
  for (const subscription of subscriptions) {
    const quantities = new Map<string, number | null>(subscription.items.map((item) => [item.price.product.code, item.quantity] as const));
    if (subscription.planId) {
      const plan = await tx.billingPlan.findUnique({ where: { id: subscription.planId }, include: { items: true } });
      for (const item of plan?.items ?? []) quantities.set((await tx.billingProduct.findUniqueOrThrow({ where: { id: item.productId }, select: { code: true } })).code, item.includedQty ?? null);
    }
    for (const propertyId of (subscription.scopePropertyIds.length ? subscription.scopePropertyIds : [null])) {
      for (const [productCode, quantity] of quantities) {
        const scopeKey = `${organizationId}:${propertyId ?? '*'}:${productCode}`;
        active.set(scopeKey, { productCode, propertyId, expiresAt: subscription.currentPeriodEnd, startsAt: subscription.currentPeriodStart, quantity });
      }
    }
  }
  const existing = await tx.entitlement.findMany({ where: { organizationId } });
  for (const [scopeKey, entitlement] of active) {
    await tx.entitlement.upsert({ where: { scopeKey }, create: { organizationId, propertyId: entitlement.propertyId, productCode: entitlement.productCode, scopeKey, status: 'ACTIVE', quantity: entitlement.quantity, startsAt: entitlement.startsAt, expiresAt: entitlement.expiresAt, metadata: { source: 'flutterwave' } }, update: { status: 'ACTIVE', quantity: entitlement.quantity, startsAt: entitlement.startsAt, expiresAt: entitlement.expiresAt, suspendedAt: null, suspensionReason: null, metadata: { source: 'flutterwave' } } });
  }
  for (const entitlement of existing) if (!active.has(entitlement.scopeKey)) await tx.entitlement.update({ where: { id: entitlement.id }, data: { status: 'SUSPENDED', suspendedAt: entitlement.suspendedAt ?? new Date(), suspensionReason: 'No active subscription' } });
}

export async function POST(req: Request) {
  const secretHash = process.env.FLW_WEBHOOK_SECRET_HASH;
  if (!process.env.FLW_SECRET_KEY || !secretHash) return NextResponse.json({ error: 'Flutterwave webhook is not configured' }, { status: 503 });
  const rawBody = await req.text();
  const signature = req.headers.get('flutterwave-signature');
  const legacySignature = req.headers.get('verif-hash');
  if (!verifyFlutterwaveWebhook(rawBody, signature, secretHash) && !verifyFlutterwaveLegacyWebhook(legacySignature, secretHash)) return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 }); }

  try {
    const data = payload?.data ?? payload;
    const transactionId = String(data?.id ?? data?.transaction_id ?? '');
    if (!transactionId) return NextResponse.json({ received: true });
    const verified = await verifyFlutterwaveTransaction(transactionId);
    const meta = verified.meta ?? data.meta ?? data.meta_data;
    const organizationId = metadataValue(meta, 'organizationId');
    if (!organizationId) throw new Error('Flutterwave transaction has no organization metadata');
    const txRef = verified.tx_ref || String(data.tx_ref || transactionId);
    const productCodes = metadataValue(meta, 'productCodes').split(',').filter(Boolean);
    const priceIds = metadataValue(meta, 'priceIds').split(',').filter(Boolean);
    const propertyIds = subscriptionScope(metadataValue(meta, 'propertyIds').split(','));
    const planId = metadataValue(meta, 'planId') || null;
    const customDomainRequestId = metadataValue(meta, 'customDomainRequestId') || null;
    const customWebsiteRequestId = metadataValue(meta, 'customWebsiteRequestId') || null;
    const status = String(verified.status || data.status || '').toLowerCase();
    const successful = status === 'successful' || status === 'success';

    await prisma.$transaction(async (tx) => {
      const duplicate = await tx.billingEvent.findUnique({ where: { flutterwaveEventId: transactionId } });
      if (duplicate) return;
      await tx.billingEvent.create({ data: { flutterwaveEventId: transactionId, type: String(payload.event || payload.type || `transaction.${status}`), organizationId, payload: payload as Prisma.InputJsonValue } });
      const now = new Date();
      const prices = priceIds.length ? await tx.billingPrice.findMany({ where: { id: { in: priceIds } }, include: { product: true } }) : await tx.billingPrice.findMany({ where: { product: { code: { in: productCodes } }, interval: 'month' }, include: { product: true } });
      const isCustomWebsiteOneTime = productCodes.includes('ADDON_CUSTOM_WEBSITE_DESIGN') && productCodes.every((code) => code === 'ADDON_CUSTOM_WEBSITE_DESIGN');
      const interval = prices[0]?.interval || 'month';
    const requestedPeriodEnd = metadataValue(meta, 'upgradePeriodEnd');
    const parsedPeriodEnd = requestedPeriodEnd ? new Date(requestedPeriodEnd) : null;
    const currentPeriodEnd = parsedPeriodEnd && !Number.isNaN(parsedPeriodEnd.getTime()) && parsedPeriodEnd > now ? parsedPeriodEnd : nextPeriod(interval, now);
      let subscriptionRef: string | null = null;
      if (!isCustomWebsiteOneTime) {
        const subscription = await tx.subscription.upsert({ where: { flutterwaveSubscriptionId: txRef }, create: { organizationId, planId, scopePropertyIds: propertyIds, flutterwaveSubscriptionId: txRef, status: successful ? 'ACTIVE' : 'PAST_DUE', currentPeriodStart: now, currentPeriodEnd, pastDueSince: successful ? null : now, cancelAtPeriodEnd: false }, update: { planId, scopePropertyIds: propertyIds, status: successful ? 'ACTIVE' : 'PAST_DUE', currentPeriodStart: now, currentPeriodEnd, pastDueSince: successful ? null : now } });
        subscriptionRef = subscription.flutterwaveSubscriptionId;
        for (const price of prices) await tx.subscriptionItem.upsert({ where: { subscriptionId_priceId: { subscriptionId: subscription.id, priceId: price.id } }, create: { subscriptionId: subscription.id, priceId: price.id, quantity: 1 }, update: { quantity: 1 } });
        if (successful && planId) await tx.subscription.updateMany({ where: { organizationId, planId: { not: null }, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }, id: { not: subscription.id } }, data: { status: 'CANCELED', canceledAt: now, cancelAtPeriodEnd: false } });
        await reconcileEntitlements(tx, organizationId);
      }
      await tx.billingInvoice.upsert({ where: { flutterwaveInvoiceId: transactionId }, create: { organizationId, flutterwaveInvoiceId: transactionId, flutterwaveCustomerId: verified.customer?.email ?? null, flutterwaveSubscriptionId: subscriptionRef, status: successful ? 'paid' : 'failed', currency: verified.currency, subtotal: Math.round(verified.amount * 100), total: Math.round(verified.amount * 100), amountPaid: successful ? Math.round(verified.amount * 100) : 0, amountDue: successful ? 0 : Math.round(verified.amount * 100), periodStart: isCustomWebsiteOneTime ? null : now, periodEnd: isCustomWebsiteOneTime ? null : currentPeriodEnd, hostedInvoiceUrl: null, invoicePdf: null, payload: verified as unknown as Prisma.InputJsonValue }, update: { status: successful ? 'paid' : 'failed', amountPaid: successful ? Math.round(verified.amount * 100) : 0, amountDue: successful ? 0 : Math.round(verified.amount * 100), payload: verified as unknown as Prisma.InputJsonValue } });
      if (customDomainRequestId && successful) {
        await tx.customDomainRequest.updateMany({ where: { id: customDomainRequestId, organizationId, status: { in: ['REQUESTED', 'PAYMENT_PENDING'] } }, data: { status: 'PAID', paidAt: now, checkoutRef: txRef } });
      }
      if (customWebsiteRequestId && successful) {
        const websiteRequest = await tx.customWebsiteRequest.findFirst({
          where: { id: customWebsiteRequestId, organizationId },
          select: { propertyId: true, developmentMode: true, metadata: true },
        });
        await tx.customWebsiteRequest.updateMany({ where: { id: customWebsiteRequestId, organizationId, status: { in: ['REQUESTED', 'PAYMENT_PENDING'] } }, data: { status: 'PAID', paidAt: now, checkoutRef: txRef } });

        // A standalone API purchase gets its public credential immediately. The
        // lookup-before-create makes webhook retries idempotent.
        if (websiteRequest?.developmentMode === 'STANDALONE_API') {
          const integration = await tx.propertyIntegration.findFirst({
            where: { organizationId, propertyId: websiteRequest.propertyId, provider: 'CUSTOM_WEBSITE' },
            select: { id: true },
          }) ?? await tx.propertyIntegration.create({
            data: {
              organizationId,
              propertyId: websiteRequest.propertyId,
              name: 'Standalone website API',
              provider: 'CUSTOM_WEBSITE',
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          const existingKey = await tx.publishableKey.findFirst({ where: { integrationId: integration.id, environment: 'LIVE', status: 'ACTIVE' } });
          if (!existingKey) {
            await tx.publishableKey.create({
              data: {
                integrationId: integration.id,
                key: createPublishableKey(),
                environment: 'LIVE',
                status: 'ACTIVE',
                allowedOrigins: websiteOrigins(websiteRequest.metadata),
              },
            });
          }
        }
      }
    }, { timeout: 30000 });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Flutterwave webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
