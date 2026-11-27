import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { assertPropertyAccess } from '@/lib/property-access';
import { errorResponse, successResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';

const ACTIVE_STATUSES = [
  'PENDING_NIGHT_AUDIT_REVIEW',
  'APPROVED_HARDWARE_PENDING',
  'CLOUD_COMPLETED_HARDWARE_PENDING',
  'PENDING_DESKTOP_RECONCILIATION',
  'CARD_ENCODING_PENDING',
  'REQUIRES_MANUAL_REVIEW',
];

/**
 * Returns cloud-completed operations whose physical card work still needs a
 * connected LodgeCore desktop terminal. The reservation endpoints are the
 * only write path; this endpoint deliberately cannot create a second,
 * incomplete reservation workflow.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

  const propertyId = req.nextUrl.searchParams.get('propertyId');
  if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);
  await assertPropertyAccess(session.user.id, propertyId);
  if (!await hasPermission(session.user.id, 'reservation', 'update', propertyId)) {
    return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
  }

  const rows = await prisma.frontdeskEmergencyOperation.findMany({
    where: { propertyId, status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  return successResponse(rows);
}

export async function POST() {
  return errorResponse(
    'USE_RESERVATION_OPERATION',
    'Use the reservation check-in or check-out endpoint with emergency=true.',
    410,
  );
}
