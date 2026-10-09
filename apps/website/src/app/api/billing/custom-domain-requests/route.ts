import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/auth';
import { checkDomainAvailability, normalizeDomain } from '@/lib/domain-availability';

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { organizationId?: string; email?: string | null } | undefined;
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : '';
    const domain = normalizeDomain(body?.domain);
    if (!propertyId || !domain) return NextResponse.json({ error: 'Property and domain are required.' }, { status: 400 });
    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId: user.organizationId, isActive: true }, select: { id: true } });
    if (!property) return NextResponse.json({ error: 'Property not found.' }, { status: 404 });
    const availability = await checkDomainAvailability(domain);
    if (!availability.available) return NextResponse.json({ error: availability.message, suggestions: availability.suggestions }, { status: availability.status === 'UNKNOWN' ? 503 : 409 });
    const existing = await prisma.customDomainRequest.findFirst({ where: { domain, status: { notIn: ['REJECTED', 'CANCELLED'] } }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'A request for this domain already exists.' }, { status: 409 });
    const domainPrice = await prisma.billingPrice.findFirst({ where: { product: { code: 'ADDON_CUSTOM_DOMAIN', active: true }, interval: 'month' }, orderBy: { amount: 'asc' }, select: { id: true, amount: true, currency: true } });
    if (!domainPrice) return NextResponse.json({ error: 'Custom-domain pricing is not configured.' }, { status: 503 });
    const bookingEngine = await prisma.entitlement.findFirst({ where: { organizationId: user.organizationId, productCode: 'ADDON_BOOKING_ENGINE', status: 'ACTIVE', OR: [{ propertyId }, { propertyId: null }] }, select: { id: true } });
    let bookingEnginePriceId: string | null = null;
    if (!bookingEngine) {
      const price = await prisma.billingPrice.findFirst({ where: { product: { code: 'ADDON_BOOKING_ENGINE', active: true }, interval: 'month' }, orderBy: { amount: 'asc' }, select: { id: true } });
      if (!price) return NextResponse.json({ error: 'Booking Engine pricing is not configured.' }, { status: 503 });
      bookingEnginePriceId = price.id;
    }
    const created = await prisma.customDomainRequest.create({ data: { organizationId: user.organizationId, propertyId, domain, status: 'REQUESTED', currency: domainPrice.currency, amount: domainPrice.amount, billingPriceId: domainPrice.id, requestedByEmail: user.email ?? null, metadata: { source: 'portal_subscription', bookingEngineIncluded: Boolean(bookingEnginePriceId) } }, select: { id: true, propertyId: true } });
    return NextResponse.json({ domainRequest: created, domainPriceId: domainPrice.id, bookingEnginePriceId }, { status: 201 });
  } catch (error) {
    console.error('[portal custom domain request]', error);
    return NextResponse.json({ error: 'Unable to create the domain request.' }, { status: 500 });
  }
}
