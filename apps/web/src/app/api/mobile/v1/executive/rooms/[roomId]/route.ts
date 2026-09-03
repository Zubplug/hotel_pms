import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { getPropertyBusinessDate } from '@/lib/kpi';
import { getRoomIntelligenceView } from '@/lib/executive/room-status';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
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
    const { roomId } = await params;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true, timezone: true }
    });

    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    // Executive route implies high-level permissions for the director dashboard
    const permissions = [...user.capabilities, 'rooms.guest.view', 'rooms.folio.view'];

    const businessDateStr = await getPropertyBusinessDate(propertyId);
    const businessDate = new Date(businessDateStr);
    
    const intelligenceView = await getRoomIntelligenceView(roomId, propertyId, businessDate, permissions);
    
    if (!intelligenceView) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        property,
        businessDate: businessDateStr,
        generatedAt: new Date().toISOString(),
        ...intelligenceView
      }
    });

  } catch (error: any) {
    console.error('Error fetching room details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch room details' },
      { status: 500 }
    );
  }
}
