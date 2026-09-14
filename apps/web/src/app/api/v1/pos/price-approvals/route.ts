import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from "@/lib/organization-access";

const ROLES = ['ACCOUNTANT', 'FINANCE_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'GENERAL_CASHIER', 'FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'CASHIER', 'FRONT_DESK_CASHIER', 'SUPER_ADMIN'];

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Approval access required', 403);
  
  const mine = req.nextUrl.searchParams.get('mine') === 'true';
  const isCashier = ['CASHIER', 'FRONT_DESK_CASHIER'].includes(user.role);
  const onlyMine = isCashier || mine;

  const approvals = await prisma.approvalRequest.findMany({
    where: { 
      propertyId: { in: user.allowedProperties }, 
      type: { in: ['POS_PRICE_CHANGE', 'POS_MENU_CREATE', 'POS_MODIFIER_CREATE', 'POS_MODIFIER_UPDATE'] }, 
      ...(onlyMine ? { requestedBy: user.id } : {}), 
      ...(onlyMine ? {} : { status: 'PENDING' }) 
    },
    orderBy: { createdAt: 'desc' }, take: 200,
  });
  const seen = new Set<string>();
  const deduplicated = approvals.filter((approval) => {
    const details = (approval.details || {}) as Record<string, any>;
    const ids = Array.isArray(details.productIds) ? [...details.productIds].sort().join(',') : details.productId || '';
    // The grouped F&B menu previously created one request per outlet copy.
    // For the requester's history, identical item/price requests are one action;
    // approver queues retain their individual records for legacy auditability.
    const key = onlyMine && approval.type === 'POS_PRICE_CHANGE'
      ? `${approval.requestedBy}:${approval.type}:${details.productName || ''}:${details.oldPrice || ''}:${details.newPrice || ''}`
      : `${approval.requestedBy}:${approval.type}:${details.productName || details.name || ''}:${details.newPrice || details.price || ''}:${ids}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return successResponse(deduplicated);
}
