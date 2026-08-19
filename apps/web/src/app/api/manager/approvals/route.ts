import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Manager access required', 403);
    }

    const allowedPropertyIds = user.allowedProperties;
    if (allowedPropertyIds.length === 0) {
      return successResponse([], 200);
    }

    const pendingApprovals = await prisma.approvalRequest.findMany({
      where: {
        propertyId: { in: allowedPropertyIds },
        status: 'PENDING'
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse(pendingApprovals, 200);

  } catch (err: any) {
    console.error('[Manager Approvals API GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching approvals', 500);
  }
}
