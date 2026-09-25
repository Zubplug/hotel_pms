import { NextResponse } from 'next/server';
import { prisma } from '@lodgecore/db';
import { getOrganizationAccess } from '@/lib/organization-access';

export async function GET(request: Request) {
  try {
    const access = await getOrganizationAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId') || access.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

    const ratePlans = await prisma.ratePlan.findMany({
      where: {
        propertyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: ratePlans });
  } catch (error: any) {
    console.error('[RATE_PLANS_GET]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
