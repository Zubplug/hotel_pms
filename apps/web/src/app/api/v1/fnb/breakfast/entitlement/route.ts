import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { BreakfastEntitlementService } from '@/lib/services/breakfast-entitlement-service';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId') || propertyIds[0];
    const roomNumber = searchParams.get('roomNumber');
    const reservationId = searchParams.get('reservationId');
    const businessDate = searchParams.get('businessDate') || undefined;

    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Property ID required', 400);
    }

    if (!propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'Forbidden property access', 403);
    }

    if (!roomNumber && !reservationId) {
      return errorResponse('BAD_REQUEST', 'Either roomNumber or reservationId is required', 400);
    }

    const result = await BreakfastEntitlementService.checkEntitlement({
      propertyId,
      roomNumber: roomNumber || undefined,
      reservationId: reservationId || undefined,
      businessDate,
    });

    return successResponse(result);
  } catch (error: any) {
    console.error('[BREAKFAST_ENTITLEMENT_GET]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Internal error', 500);
  }
}
