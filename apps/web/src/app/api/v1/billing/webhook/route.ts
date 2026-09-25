import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@hotel-pms/db';
import type { Prisma } from '@hotel-pms/db';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2023-10-16' }) : null;

function statusFor(subscription: Stripe.Subscription) {
  if (subscription.pause_collection) return 'PAUSED';
  if (subscription.status === 'past_due') return 'PAST_DUE';
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') return 'CANCELED';
  if (subscription.status === 'trialing') return 'TRIALING';
  if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') return 'INCOMPLETE';
  return 'ACTIVE';
}

async function findOrganizationId(tx: Prisma.TransactionClient, object: any) {
  if (typeof object?.metadata?.organizationId === 'string') return object.metadata.organizationId;
  const customerId = typeof object?.customer === 'string' ? object.customer : null;
  if (!customerId) return null;
  const customer = await tx.billingCustomer.findUnique({ where: { stripeCustomerId: customerId } });
  return customer?.organizationId ?? null;
}

async function reconcileEntitlements(tx: Prisma.TransactionClient, organizationId: string) {
  const subscriptions = await tx.subscription.findMany({
    where: { organizationId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
    include: { items: { include: { price: { include: { product: true } } } } },
  });
  const active = new Map<string, Date>();
  for (const subscription of subscriptions) {
    for (const item of subscription.items) {
      const current = active.get(item.price.product.code);
      if (!current || current < subscription.currentPeriodEnd) active.set(item.price.product.code, subscription.currentPeriodEnd);
    }
  }

  const existing = await tx.entitlement.findMany({ where: { organizationId } });
  for (const [productCode, expiresAt] of active) {
    await tx.entitlement.upsert({
      where: { organizationId_productCode: { organizationId, productCode } },
      create: { organizationId, productCode, status: 'ACTIVE', expiresAt },
      update: { status: 'ACTIVE', expiresAt, suspendedAt: null, suspensionReason: null },
    });
  }
  for (const entitlement of existing) {
    if (!active.has(entitlement.productCode)) {
      await tx.entitlement.update({
        where: { id: entitlement.id },
        data: { status: 'SUSPENDED', suspendedAt: entitlement.suspendedAt ?? new Date(), suspensionReason: 'No active subscription' },
      });
    }
  }
}

async function handleSubscriptionChange(tx: Prisma.TransactionClient, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const customer = await tx.billingCustomer.findUnique({ where: { stripeCustomerId: customerId } });
  if (!customer) throw new Error(`Unknown Stripe customer ${customerId}`);
  const status = statusFor(subscription);
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const saved = await tx.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: { organizationId: customer.organizationId, stripeSubscriptionId: subscription.id, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd: subscription.cancel_at_period_end, canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null, trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null },
    update: { status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd: subscription.cancel_at_period_end, canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null, trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null },
  });
  const prices = await Promise.all(subscription.items.data.map((item) => tx.billingPrice.findUnique({ where: { stripePriceId: item.price.id } })));
  if (prices.some((price) => !price)) throw new Error(`Stripe subscription ${subscription.id} contains an unknown catalog price`);
  const priceIds = prices.map((price) => price!.id);
  await tx.subscriptionItem.deleteMany({ where: { subscriptionId: saved.id, ...(priceIds.length ? { priceId: { notIn: priceIds } } : {}) } });
  for (const priceId of priceIds) {
    await tx.subscriptionItem.upsert({ where: { subscriptionId_priceId: { subscriptionId: saved.id, priceId } }, create: { subscriptionId: saved.id, priceId }, update: {} });
  }
  await reconcileEntitlements(tx, customer.organizationId);
}

async function handleInvoice(tx: Prisma.TransactionClient, invoice: Stripe.Invoice) {
  const organizationId = await findOrganizationId(tx, invoice);
  if (!organizationId) throw new Error(`Unknown Stripe customer ${invoice.customer}`);
  await tx.billingInvoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: { organizationId, stripeInvoiceId: invoice.id, stripeCustomerId: String(invoice.customer), stripeSubscriptionId: typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null, status: invoice.status ?? 'unknown', currency: invoice.currency, subtotal: invoice.subtotal ?? 0, total: invoice.total ?? 0, amountPaid: invoice.amount_paid ?? 0, amountDue: invoice.amount_due ?? 0, periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null, periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null, hostedInvoiceUrl: invoice.hosted_invoice_url, invoicePdf: invoice.invoice_pdf, payload: invoice as unknown as Prisma.InputJsonValue },
    update: { status: invoice.status ?? 'unknown', subtotal: invoice.subtotal ?? 0, total: invoice.total ?? 0, amountPaid: invoice.amount_paid ?? 0, amountDue: invoice.amount_due ?? 0, periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null, periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null, hostedInvoiceUrl: invoice.hosted_invoice_url, invoicePdf: invoice.invoice_pdf, payload: invoice as unknown as Prisma.InputJsonValue },
  });
}

export async function POST(req: Request) {
  if (!stripe || !endpointSecret) return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 503 });
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, endpointSecret);
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }
  try {
    let duplicate = false;
    await prisma.$transaction(async (tx) => {
      const object = event.data.object as any;
      const organizationId = await findOrganizationId(tx, object);
      try {
        await tx.billingEvent.create({ data: { stripeEventId: event.id, type: event.type, payload: event as unknown as Prisma.InputJsonValue, organizationId } });
      } catch (error) {
        if ((error as { code?: string })?.code === 'P2002') { duplicate = true; return; }
        throw error;
      }
      if (event.type.startsWith('customer.subscription.')) await handleSubscriptionChange(tx, object as Stripe.Subscription);
      if (event.type === 'invoice.created' || event.type === 'invoice.finalized' || event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') await handleInvoice(tx, object as Stripe.Invoice);
    }, { timeout: 30000 });
    return NextResponse.json({ received: true, duplicate });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
