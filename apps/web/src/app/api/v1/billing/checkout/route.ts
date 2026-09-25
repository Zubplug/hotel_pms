import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma, { Prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2026-08-26.dahlia' }) : null;

function safeReturnUrl(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    const url = new URL(value, process.env.NEXT_PUBLIC_APP_URL);
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_APP_URL!).origin) return fallback;
    return url.toString();
  } catch { return fallback; }
}

export async function POST(req: Request) {
  try {
    if (!stripe) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, priceId, successUrl, cancelUrl } = await req.json();
    const requestId = req.headers.get('Idempotency-Key');

    if (!organizationId || !priceId) {
      return NextResponse.json({ error: 'Missing organizationId or priceId' }, { status: 400 });
    }

    // Verify user belongs to the organization or is HQ Admin
    if (!session.user.isLodgeCoreAdmin && session.user.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the price exists in LodgeCore catalog
    const billingPrice = await prisma.billingPrice.findUnique({
      where: { id: priceId },
      include: { product: true }
    });

    if (!billingPrice || !billingPrice.product.active || !billingPrice.stripePriceId) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { billingCustomer: true }
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    let customerId = organization.billingCustomer?.stripeCustomerId;

    if (!customerId) {
      // Create Stripe Customer
      const customer = await stripe.customers.create({
        name: organization.name,
        metadata: {
          organizationId: organization.id
        }
      });
      customerId = customer.id;

      // Link in database
      try {
        await prisma.billingCustomer.create({ data: { organizationId: organization.id, stripeCustomerId: customerId } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        customerId = (await prisma.billingCustomer.findUniqueOrThrow({ where: { organizationId: organization.id } })).stripeCustomerId;
      }
    }

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: billingPrice.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: safeReturnUrl(successUrl, `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`),
      cancel_url: safeReturnUrl(cancelUrl, `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`),
      metadata: {
        organizationId,
        productId: billingPrice.productId,
        productCode: billingPrice.product.code
      },
      subscription_data: { metadata: { organizationId, productCode: billingPrice.product.code } },
    }, requestId ? { idempotencyKey: requestId } : undefined);

    return NextResponse.json({ url: checkoutSession.url });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
