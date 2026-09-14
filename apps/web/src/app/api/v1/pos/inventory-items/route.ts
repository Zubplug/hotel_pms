import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';

const MENU_ROLES = ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'];

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!MENU_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'F&B management access required', 403);
  const ctx = await requireOrganizationContext(user.id);
  const propertyId = new URL(req.url).searchParams.get('propertyId');
  if (!propertyId || (!ctx.propertyIds.includes(propertyId) && !user.isSuperAdmin)) return errorResponse('FORBIDDEN', 'No access to this property', 403);

  const items = await prisma.stockItem.findMany({
    where: { propertyId, isActive: true, posProductId: null, warehouse: { isActive: true, posOutletId: null } },
    select: { id: true, name: true, sku: true, baseUnit: true, quantityOnHand: true, warehouse: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  return successResponse(items);
}
