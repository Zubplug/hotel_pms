import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { calculateRoomStatuses } from '@/lib/executive/room-status';
import { getPropertyBusinessDate } from '@/lib/kpi';

// NOTE: In a real production app, use proper authentication (e.g., getServerSession).
// For now, we simulate the authenticated director context.
const MOCK_DIRECTOR_PROPERTY_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate and authorize property access
    // Extract propertyId from request headers or auth session
    // const propertyId = req.headers.get('x-property-id') || MOCK_DIRECTOR_PROPERTY_ID;
    const propertyId = MOCK_DIRECTOR_PROPERTY_ID; // Forced for this scope

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
