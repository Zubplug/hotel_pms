import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma, { Prisma } from '@hotel-pms/db';
import { markTrialConverted, reconcileOrganizationEntitlements, subscriptionScope, verifyFlutterwaveLegacyWebhook, verifyFlutterwaveTransaction, verifyFlutterwaveWebhook } from '@hotel-pms/db';

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

async function reconcileReachPrograms(tx: Prisma.TransactionClient, organizationId: string) {
  const [properties, reachEntitlements, reachPrice] = await Promise.all([
    tx.property.findMany({ where: { organizationId, isActive: true }, select: { id: true } }),
    tx.entitlement.findMany({ where: { organizationId, productCode: 'ADDON_REACH', status: 'ACTIVE' }, select: { propertyId: true } }),
    tx.billingPrice.findFirst({ where: { product: { code: 'ADDON_REACH', active: true }, interval: 'one_time' }, orderBy: { createdAt: 'desc' }, select: { amount: true, currency: true } }),
  ]);
  const entitledPropertyIds = new Set(
    properties.filter((property) => reachEntitlements.some((entitlement) => entitlement.propertyId === null || entitlement.propertyId === property.id)).map((property) => property.id),
  );
  const amount = reachPrice ? reachPrice.amount / 100 : 0;
  const currency = reachPrice?.currency || 'NGN';
  for (const property of properties) {
    const existing = await tx.referralProgram.findUnique({ where: { propertyId: property.id }, select: { id: true } });
    if (entitledPropertyIds.has(property.id)) {
      if (existing) {
        await tx.referralProgram.update({ where: { id: existing.id }, data: { activationFeeAmount: amount, activationFeeCurrency: currency, activationPaymentStatus: 'PAID' } });
      } else {
        await tx.referralProgram.create({ data: { organizationId, propertyId: property.id, enabled: true, activatedAt: new Date(), activationFeeAmount: amount, activationFeeCurrency: currency, activationPaymentStatus: 'PAID', activationFeePaidAt: new Date() } });
      }
    } else if (existing) {
      await tx.referralProgram.updateMany({ where: { id: existing.id, enabled: true }, data: { enabled: false, pausedAt: new Date() } });
    }
  }
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

  // Flutterwave supports one webhook URL per account. Keep Reach activation
  // payments on the same HQ billing endpoint and hand them to the dedicated
  // activation reconciler before normal subscription processing.
  const webhookMeta = payload?.data?.meta ?? payload?.data?.meta_data ?? payload?.meta ?? payload?.meta_data;
  const reachSource = metadataValue(webhookMeta, 'lodgecore_source');
  if (reachSource === 'reach_activation' || reachSource === 'reach_wallet') {
    const reachUrl = new URL(
      reachSource === 'reach_activation' ? '/api/v1/referrals/activation/webhook' : '/api/v1/reach/wallet/webhook',
      req.url,
    );
    return fetch(reachUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(signature ? { 'flutterwave-signature': signature } : {}),
        ...(legacySignature ? { 'verif-hash': legacySignature } : {}),
      },
      body: rawBody,
    });
  }

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
    const quantities = metadataValue(meta, 'quantities').split(',').map((value) => Math.max(1, Math.min(25, Math.floor(Number(value) || 1))));
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
        const existingProviderSubscription = await tx.subscription.findUnique({ where: { flutterwaveSubscriptionId: txRef }, select: { id: true } });
        const effectivePeriodEnd = !successful && !existingProviderSubscription ? now : currentPeriodEnd;
        const subscription = await tx.subscription.upsert({ where: { flutterwaveSubscriptionId: txRef }, create: { organizationId, planId, scopePropertyIds: propertyIds, flutterwaveSubscriptionId: txRef, status: successful ? 'ACTIVE' : 'PAST_DUE', currentPeriodStart: now, currentPeriodEnd: effectivePeriodEnd, pastDueSince: successful ? null : now, cancelAtPeriodEnd: false }, update: { planId, scopePropertyIds: propertyIds, status: successful ? 'ACTIVE' : 'PAST_DUE', currentPeriodStart: now, currentPeriodEnd: effectivePeriodEnd, pastDueSince: successful ? null : now } });
        subscriptionRef = subscription.flutterwaveSubscriptionId;
        for (const price of prices) {
          const requestedQuantity = quantities[priceIds.indexOf(price.id)] ?? 1;
          const quantity = price.product.code === 'ADDON_EXTRA_TERMINAL' ? requestedQuantity : 1;
          await tx.subscriptionItem.upsert({ where: { subscriptionId_priceId: { subscriptionId: subscription.id, priceId: price.id } }, create: { subscriptionId: subscription.id, priceId: price.id, quantity }, update: { quantity } });
        }
        if (successful && planId) await tx.subscription.updateMany({ where: { organizationId, planId: { not: null }, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }, id: { not: subscription.id } }, data: { status: 'CANCELED', canceledAt: now, cancelAtPeriodEnd: false } });
        await reconcileOrganizationEntitlements(tx, organizationId, now);
        if (successful) {
          const trial = await tx.trialHistory.findUnique({ where: { organizationId }, select: { subscriptionId: true, status: true } });
          if (trial?.status === 'STARTED' && trial.subscriptionId !== subscription.id) {
            await markTrialConverted(tx, { subscriptionId: trial.subscriptionId, now });
          }
        }
        if (successful) await reconcileReachPrograms(tx, organizationId);
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
