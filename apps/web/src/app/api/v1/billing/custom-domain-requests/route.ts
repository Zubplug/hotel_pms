import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { checkDomainAvailability, normalizeDomain } from '@/lib/domain-availability';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const domain = normalizeDomain(body?.domain);
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : '';
    const includeBookingEngine = body?.includeBookingEngine === true;
    if (!domain || !propertyId) return NextResponse.json({ error: 'A valid domain and property are required.' }, { status: 400 });

    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId: session.user.organizationId, isActive: true }, select: { id: true } });
    if (!property) return NextResponse.json({ error: 'Property not found.' }, { status: 404 });
    const bookingEngineEntitlement = await prisma.entitlement.findFirst({ where: { organizationId: session.user.organizationId, productCode: 'ADDON_BOOKING_ENGINE', status: 'ACTIVE', OR: [{ propertyId }, { propertyId: null }] }, select: { id: true } });
    if (!bookingEngineEntitlement && !includeBookingEngine) return NextResponse.json({ code: 'BOOKING_ENGINE_REQUIRED', error: 'Booking Engine is required before requesting a custom domain.' }, { status: 409 });
    const price = await prisma.billingPrice.findFirst({ where: { product: { code: 'ADDON_CUSTOM_DOMAIN', active: true }, interval: 'month' }, orderBy: { amount: 'asc' }, select: { id: true, amount: true, currency: true } });
    if (!price) return NextResponse.json({ error: 'Custom-domain pricing is not configured yet.' }, { status: 503 });

    const availability = await checkDomainAvailability(domain);
    if (!availability.available) return NextResponse.json({ error: availability.message }, { status: availability.status === 'UNKNOWN' ? 503 : 409 });

    const bookingEnginePrice = !bookingEngineEntitlement ? await prisma.billingPrice.findFirst({ where: { product: { code: 'ADDON_BOOKING_ENGINE', active: true }, interval: 'month' }, orderBy: { amount: 'asc' }, select: { id: true } }) : null;
    if (!bookingEngineEntitlement && !bookingEnginePrice) return NextResponse.json({ error: 'Booking Engine pricing is not configured yet.' }, { status: 503 });

    const existing = await prisma.customDomainRequest.findFirst({ where: { propertyId, domain } });
    if (existing && !['REJECTED', 'CANCELLED'].includes(existing.status)) return NextResponse.json({ request: existing, bookingEnginePriceId: bookingEnginePrice?.id ?? null }, { status: 200 });

    const requestRecord = existing
      ? await prisma.customDomainRequest.update({ where: { id: existing.id }, data: { status: 'REQUESTED', billingPriceId: price.id, amount: price.amount, currency: price.currency, requestedByEmail: session.user.email ?? null, reviewedBy: null, reviewedAt: null, notes: null }, select: { id: true, domain: true, propertyId: true, status: true, amount: true, currency: true, billingPriceId: true } })
      : await prisma.customDomainRequest.create({ data: { organizationId: session.user.organizationId, propertyId, domain, requestedByEmail: session.user.email ?? null, status: 'REQUESTED', billingPriceId: price.id, amount: price.amount, currency: price.currency, metadata: { availabilityProvider: 'rdap.org' } }, select: { id: true, domain: true, propertyId: true, status: true, amount: true, currency: true, billingPriceId: true } });

    return NextResponse.json({ request: requestRecord, bookingEnginePriceId: bookingEnginePrice?.id ?? null }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error('[custom-domain-request]', error);
    return NextResponse.json({ error: 'Unable to submit the domain configuration request.' }, { status: 500 });
  }
}
