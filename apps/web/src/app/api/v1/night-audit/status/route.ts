import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { getPropertyBusinessDate, getNextBusinessDate } from '@/lib/date-utils';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    await assertPropertyAccess(session.user.id, propertyId);

    const property = await prisma.property.findUnique({ where: { id: propertyId }});
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const businessDate = getPropertyBusinessDate(property.timezone, new Date());
    const nextBusinessDate = getNextBusinessDate(businessDate);

    // Get the latest Night Audit run for this business date
    const currentAudit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });

    // Check how many stayovers we *should* generate
    const eligibleCount = await prisma.reservation.count({
      where: {
        propertyId,
        status: 'CHECKED_IN',
        checkOut: { gt: nextBusinessDate }
      }
    });

    return successResponse({
      timezone: property.timezone,
      businessDate,
      nextBusinessDate,
      audit: currentAudit || null,
      projectedStayovers: eligibleCount
    });

  } catch (err: any) {
    console.error('[Night Audit GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
