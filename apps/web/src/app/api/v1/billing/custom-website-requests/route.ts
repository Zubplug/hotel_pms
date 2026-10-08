import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { checkDomainAvailability, normalizeDomain } from '@/lib/domain-availability';

export async function POST(request: Request) {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : '';
    const brief = body?.brief && typeof body.brief === 'object' ? body.brief : null;
    const requestedDomain = normalizeDomain(body?.domain);
    if (!propertyId || !brief || typeof brief.projectName !== 'string' || !brief.projectName.trim() || typeof brief.pages !== 'string' || !brief.pages.trim()) {
      return NextResponse.json({ error: 'Project name and required website pages are needed.' }, { status: 400 });
    }

    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId, isActive: true }, select: { id: true } });
    if (!property) return NextResponse.json({ error: 'Property not found.' }, { status: 404 });
    const websitePrice = await prisma.billingPrice.findFirst({ where: { product: { code: 'ADDON_CUSTOM_WEBSITE_DESIGN', active: true }, interval: 'one_time' }, orderBy: { amount: 'asc' }, select: { id: true, amount: true, currency: true } });
    if (!websitePrice) return NextResponse.json({ error: 'Custom website pricing is not configured yet.' }, { status: 503 });

    let domainPrice: { id: string; amount: number; currency: string } | null = null;
    let bookingEnginePriceId: string | null = null;
    if (requestedDomain) {
      const availability = await checkDomainAvailability(requestedDomain);
      if (!availability.available) return NextResponse.json({ error: availability.message, suggestions: availability.suggestions }, { status: availability.status === 'UNKNOWN' ? 503 : 409 });
      const existingDomain = await prisma.customDomainRequest.findFirst({ where: { domain: requestedDomain } });
      if (existingDomain) return NextResponse.json({ error: 'A request for this domain already exists.' }, { status: 409 });
      domainPrice = await prisma.billingPrice.findFirst({ where: { product: { code: 'ADDON_CUSTOM_DOMAIN', active: true }, interval: 'month' }, orderBy: { amount: 'asc' }, select: { id: true, amount: true, currency: true } });
      if (!domainPrice) return NextResponse.json({ error: 'Custom-domain pricing is not configured yet.' }, { status: 503 });
      const bookingEngine = await prisma.entitlement.findFirst({ where: { organizationId, productCode: 'ADDON_BOOKING_ENGINE', status: 'ACTIVE', OR: [{ propertyId }, { propertyId: null }] }, select: { id: true } });
      if (!bookingEngine) {
        const bookingPrice = await prisma.billingPrice.findFirst({ where: { product: { code: 'ADDON_BOOKING_ENGINE', active: true }, interval: 'month' }, orderBy: { amount: 'asc' }, select: { id: true } });
        if (!bookingPrice) return NextResponse.json({ error: 'Booking Engine pricing is not configured yet.' }, { status: 503 });
        bookingEnginePriceId = bookingPrice.id;
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const websiteRequest = await tx.customWebsiteRequest.create({ data: { organizationId, propertyId, status: 'REQUESTED', currency: websitePrice.currency, amount: websitePrice.amount, billingPriceId: websitePrice.id, requestedByEmail: session.user.email ?? null, brief: JSON.stringify(brief), metadata: { source: 'billing_addon', domain: requestedDomain, bookingEngineIncluded: Boolean(bookingEnginePriceId) } }, select: { id: true, propertyId: true, status: true } });
      const domainRequest = requestedDomain && domainPrice ? await tx.customDomainRequest.create({ data: { organizationId, propertyId, domain: requestedDomain, status: 'REQUESTED', currency: domainPrice.currency, amount: domainPrice.amount, billingPriceId: domainPrice.id, requestedByEmail: session.user.email ?? null, metadata: { source: 'custom_website_addon' } }, select: { id: true, billingPriceId: true } }) : null;
      return { websiteRequest, domainRequest };
    });

    return NextResponse.json({ ...created, websitePriceId: websitePrice.id, domainPriceId: domainPrice?.id ?? null, bookingEnginePriceId }, { status: 201 });
  } catch (error) {
    console.error('[custom-website-request]', error);
    return NextResponse.json({ error: 'Unable to create the custom website request.' }, { status: 500 });
  }
}
