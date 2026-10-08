import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { checkDomainAvailability } from '@/lib/domain-availability';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  const propertyId = url.searchParams.get('propertyId');
  const result = await checkDomainAvailability(domain);
  let bookingEngineRequired = false;
  if (propertyId && session.user.organizationId) {
    const entitlement = await prisma.entitlement.findFirst({ where: { organizationId: session.user.organizationId, productCode: 'ADDON_BOOKING_ENGINE', status: 'ACTIVE', OR: [{ propertyId }, { propertyId: null }] }, select: { id: true } });
    bookingEngineRequired = !entitlement;
  }
  if (result.status === 'AVAILABLE') {
    const existing = await prisma.customDomainRequest.findFirst({ where: { domain: result.domain }, select: { id: true } });
    if (existing) return NextResponse.json({ ...result, available: false, status: 'REGISTERED', message: 'A request for this domain already exists.', suggestions: [], bookingEngineRequired });
  }
  return NextResponse.json({ ...result, bookingEngineRequired }, { status: result.status === 'UNKNOWN' ? 503 : 200 });
}
