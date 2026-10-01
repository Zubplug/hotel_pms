import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma, { billingMetadata, billingPriceIds, createFlutterwaveCheckout } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { validateCheckoutSelection } from '@hotel-pms/db';

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
    if (!process.env.FLW_SECRET_KEY) return NextResponse.json({ error: 'Flutterwave is not configured' }, { status: 503 });
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, priceId, priceIds, planId, propertyIds, successUrl, cancelUrl } = await req.json();
    const requestId = req.headers.get('Idempotency-Key');

    const requestedPriceIds = billingPriceIds(priceId, priceIds);
    if (!organizationId || requestedPriceIds.length === 0) {
      return NextResponse.json({ error: 'Missing organizationId or priceId' }, { status: 400 });
    }

    // Verify user belongs to the organization or is HQ Admin
    if (!session.user.isLodgeCoreAdmin && session.user.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the price exists in LodgeCore catalog
    let prices;
    let plan;
    let scopedPropertyIds;
    try {
      ({ prices, plan, propertyIds: scopedPropertyIds } = await validateCheckoutSelection(prisma, { organizationId, priceIds: requestedPriceIds, planId: typeof planId === 'string' ? planId : null, propertyIds: Array.isArray(propertyIds) ? propertyIds.map(String) : [] }));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid billing selection' }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const metadata = billingMetadata({ organizationId, planId: plan?.id, propertyIds: scopedPropertyIds, productCodes: prices.map((price) => price.product.code), priceIds: prices.map((price) => price.id) });
    const interval = prices[0]?.interval;
    const configuredPlan = prices.length === 1 ? Number(prices[0]?.flutterwavePriceId) : Number(interval === 'year' ? process.env.FLW_YEARLY_PAYMENT_PLAN_ID : process.env.FLW_MONTHLY_PAYMENT_PLAN_ID);
    if (!session.user.email) return NextResponse.json({ error: 'A billing email is required' }, { status: 400 });
    const checkout = await createFlutterwaveCheckout({ amount: Math.round(prices.reduce((sum, price) => sum + price.amount, 0) / 100), currency: prices[0]?.currency || 'NGN', txRef: `lodgecore-${organizationId}-${requestId || randomUUID()}`, redirectUrl: safeReturnUrl(successUrl, `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`), customer: { email: session.user.email, name: organization.name }, paymentPlan: Number.isInteger(configuredPlan) && configuredPlan > 0 ? configuredPlan : undefined, paymentOptions: Number.isInteger(configuredPlan) && configuredPlan > 0 ? 'card' : undefined, meta: metadata });
    return NextResponse.json({ url: checkout.link });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
