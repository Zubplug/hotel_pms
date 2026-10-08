import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma, { billingMetadata, billingPriceIds, billingTotal, createFlutterwaveCheckout } from '@hotel-pms/db';
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

    const { organizationId, priceId, priceIds, planId, propertyIds, successUrl, cancelUrl, customDomainRequestId, customWebsiteRequestId } = await req.json();
    const requestId = req.headers.get('Idempotency-Key');

    const requestedPriceIds = billingPriceIds(priceId, priceIds);
    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    // Verify user belongs to the organization or is HQ Admin
    if (!session.user.isLodgeCoreAdmin && session.user.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let checkoutPropertyIds = Array.isArray(propertyIds) ? propertyIds.map(String) : [];
    if (customDomainRequestId) {
      const domainRequest = await prisma.customDomainRequest.findFirst({ where: { id: customDomainRequestId, organizationId, status: { in: ['REQUESTED', 'PAYMENT_PENDING'] } }, select: { propertyId: true, billingPriceId: true } });
      if (!domainRequest) return NextResponse.json({ error: 'Custom-domain request is not ready for payment' }, { status: 409 });
      if (!requestedPriceIds.length && domainRequest.billingPriceId) requestedPriceIds.push(domainRequest.billingPriceId);
      checkoutPropertyIds = [domainRequest.propertyId];
    }
    if (customWebsiteRequestId) {
      const websiteRequest = await prisma.customWebsiteRequest.findFirst({ where: { id: customWebsiteRequestId, organizationId, status: { in: ['REQUESTED', 'PAYMENT_PENDING'] } }, select: { propertyId: true, billingPriceId: true } });
      if (!websiteRequest) return NextResponse.json({ error: 'Custom website request is not ready for payment' }, { status: 409 });
      if (!requestedPriceIds.length && websiteRequest.billingPriceId) requestedPriceIds.push(websiteRequest.billingPriceId);
      checkoutPropertyIds = [websiteRequest.propertyId];
    }
    if (requestedPriceIds.length === 0) {
      return NextResponse.json({ error: 'Missing catalog price' }, { status: 400 });
    }

    // Verify the price exists in LodgeCore catalog
    let prices;
    let plan;
    let scopedPropertyIds;
    try {
      ({ prices, plan, propertyIds: scopedPropertyIds } = await validateCheckoutSelection(prisma, { organizationId, priceIds: requestedPriceIds, planId: typeof planId === 'string' ? planId : null, propertyIds: checkoutPropertyIds }));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid billing selection' }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const metadata = billingMetadata({ organizationId, planId: plan?.id, propertyIds: scopedPropertyIds, productCodes: prices.map((price) => price.product.code), priceIds: prices.map((price) => price.id), customDomainRequestId, customWebsiteRequestId });
    if (!session.user.email) return NextResponse.json({ error: 'A billing email is required' }, { status: 400 });
    const checkout = await createFlutterwaveCheckout({ amount: Math.round(billingTotal(prices, scopedPropertyIds) / 100), currency: prices[0]?.currency || 'NGN', txRef: `lodgecore-${organizationId}-${requestId || randomUUID()}`, redirectUrl: safeReturnUrl(successUrl, `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`), customer: { email: session.user.email, name: organization.name }, meta: metadata });
    return NextResponse.json({ url: checkout.link });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
