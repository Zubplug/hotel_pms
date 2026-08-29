import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

const ROLES = ['ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER', 'SUPER_ADMIN'];

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Approval access required', 403);
  const isCashier = ['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'].includes(user.role);
  const approvals = await prisma.approvalRequest.findMany({
    where: { propertyId: { in: user.allowedProperties }, type: { in: ['POS_PRICE_CHANGE', 'POS_MENU_CREATE', 'POS_MODIFIER_CREATE', 'POS_MODIFIER_UPDATE'] }, ...(isCashier ? { requestedBy: user.id } : {}), ...(isCashier ? {} : { status: 'PENDING' }) },
    orderBy: { createdAt: 'desc' }, take: 200,
  });
  return successResponse(approvals);
}
