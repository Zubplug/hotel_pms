import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const context = await requireOrganizationContext(session.user.id);
  const propertyId = req.nextUrl.searchParams.get('propertyId');
  const campaigns = await prisma.referralCampaign.findMany({
    where: { organizationId: context.organizationId, ...(propertyId && context.propertyIds.includes(propertyId) ? { propertyId } : { propertyId: { in: [...context.propertyIds] } }) },
    orderBy: { createdAt: 'desc' },
    include: { partner: { select: { id: true, displayName: true, status: true, verificationStatus: true } }, program: { select: { enabled: true } } },
  });
  return successResponse({ campaigns });
}
