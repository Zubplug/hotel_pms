import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

const ROLES = ['ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'];

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Approval access required', 403);
  const approvals = await prisma.approvalRequest.findMany({
    where: { propertyId: { in: user.allowedProperties }, type: 'POS_PRICE_CHANGE', status: 'PENDING' },
    orderBy: { createdAt: 'desc' }, take: 200,
  });
  return successResponse(approvals);
}
