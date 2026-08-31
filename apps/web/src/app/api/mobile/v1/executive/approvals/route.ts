import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { prisma } from '@hotel-pms/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    const ctx = await requireOrganizationContext(user.id);
    const propertyId = req.nextUrl.searchParams.get('propertyId') || 'ALL_AUTHORIZED';
    const allowedPropertyIds = ctx.propertyIds;
    const targetProperties = propertyId === 'ALL_AUTHORIZED' ? [...allowedPropertyIds] : [propertyId];

    if (targetProperties.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }


    const pendingApprovals = await prisma.approvalRequest.findMany({
      where: {
        propertyId: { in: targetProperties },
        status: 'PENDING'
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
