import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { calculateRoomStatuses } from '@/lib/executive/room-status';
import { getPropertyBusinessDate } from '@/lib/kpi';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    const ctx = await requireOrganizationContext(user.id);
    const allowedPropertyIds = ctx.propertyIds;
    if (allowedPropertyIds.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }

    if (allowedPropertyIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No property access' }, { status: 403 });
    }

    const propertyId = allowedPropertyIds[0];

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true, timezone: true }
    });

    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found or access denied' }, { status: 403 });
    }

    // 2. Authoritative business date
    const businessDate = await getPropertyBusinessDate(propertyId);

    // 3. Shared status calculation
    const { overview, rooms } = await calculateRoomStatuses(propertyId, businessDate);

    return NextResponse.json({
      success: true,
      data: {
        property: {
          id: property.id,
          name: property.name,
          timezone: property.timezone
        },
        businessDate: businessDate.toISOString().split('T')[0],
        generatedAt: new Date().toISOString(),
        overview,
        rooms
      }
    });

  } catch (error: any) {
    console.error('[Rooms BFF Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve room status data' },
      { status: 500 }
    );
  }
}
