import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasAnyPropertyModuleEntitlement, hasPropertyModuleEntitlement } from '@/lib/auth/service-entitlement';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const requestedPropertyId = searchParams.get('propertyId');
    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
    const entitled = requestedPropertyId
      ? await hasPropertyModuleEntitlement(session.user.id, requestedPropertyId, 'MODULE_OPERATIONS')
      : await hasAnyPropertyModuleEntitlement(session.user.id, allowedPropertyIds, 'MODULE_OPERATIONS');
    if (!entitled) return errorResponse('PAYMENT_REQUIRED', 'An active Operations entitlement is required for Events and Halls.', 402);

    if (requestedPropertyId && !allowedPropertyIds.includes(requestedPropertyId) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const propertyIdsToQuery = requestedPropertyId ? [requestedPropertyId] : allowedPropertyIds;

    const events = await prisma.event.findMany({
      where: {
        propertyId: { in: propertyIdsToQuery as string[] }
      },
      include: {
        bookings: { include: { hall: true } },
        invoices: true
      },
      orderBy: { startDate: 'asc' },
      take: 50
    });

    return successResponse({
      events
    }, 200);
  } catch (err: any) {
    console.error('[FNB Events GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching events', 500);
  }
}
