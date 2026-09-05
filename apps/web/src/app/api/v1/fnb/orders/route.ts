import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const requestedPropertyId = searchParams.get('propertyId');
    const requestedOutletId = searchParams.get('outletId');
    
    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;

    if (requestedPropertyId && !allowedPropertyIds.includes(requestedPropertyId) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const propertyIdsToQuery = requestedPropertyId ? [requestedPropertyId] : allowedPropertyIds;

    const activeOrders = await prisma.posOrder.findMany({
      where: {
        propertyId: { in: propertyIdsToQuery as string[] },
        ...(requestedOutletId ? { outletId: requestedOutletId } : {}),
        status: { in: ['SUBMITTED', 'IN_SERVICE'] }
      },
      include: {
        table: true,
        items: true,
        kots: true,
        serverStaff: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return successResponse({
      orders: activeOrders
    }, 200);
  } catch (err: any) {
    console.error('[FNB Orders GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching orders', 500);
  }
}
