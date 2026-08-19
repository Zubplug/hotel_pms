import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { prisma } from '@hotel-pms/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 'EXECUTIVE'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Executive access required', 403);
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
      include: {
        requester: {
          select: { firstName: true, lastName: true, department: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return successResponse(pendingApprovals, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Approvals GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching approvals', 500);
  }
}
