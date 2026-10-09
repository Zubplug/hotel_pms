import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@hotel-pms/db';
import { checkDomainAvailability } from '@/lib/domain-availability';

export async function GET(request: Request) {
  const session = await auth();
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const result = await checkDomainAvailability(url.searchParams.get('domain'));
  if (result.available) {
    const existing = await prisma.customDomainRequest.findFirst({ where: { domain: result.domain }, select: { id: true } });
    if (existing) return NextResponse.json({ ...result, available: false, status: 'REGISTERED', message: 'A request for this domain already exists.', suggestions: [] });
  }
  return NextResponse.json(result, { status: result.status === 'UNKNOWN' ? 503 : 200 });
}
