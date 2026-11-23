import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';

// Returns only a queue count for the authenticated PMS session. Order details
// remain protected by the operator token endpoint and are loaded after POS
// operator login/shift selection.
export async function GET() {
  try {
    const session = await auth();
    const userId = (session?.user as any)?.id;
    const propertyId = (session?.user as any)?.propertyId;
    if (!userId || !propertyId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const organization = await requireOrganizationContext(userId);
    if (!organization.propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'Property access denied' }, { status: 403 });
    }

    const count = await prisma.posOrder.count({
      where: {
        propertyId,
        orderType: 'ROOM_SERVICE',
        status: 'SUBMITTED',
      },
    });

    return NextResponse.json({ data: { count } });
  } catch (error: any) {
    console.error('[GET /api/v1/room-service/pending-summary]', error);
    return NextResponse.json({ error: 'Unable to read room-service queue' }, { status: 500 });
  }
}
