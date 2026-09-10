import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const item = await prisma.laundryItem.findUnique({ where: { id } });
    if (!item) return errorResponse('NOT_FOUND', 'Laundry catalog item not found', 404);

    const allowedProperties = (await requireOrganizationContext(session.user.id)).propertyIds;
    if (!allowedProperties.includes(item.propertyId)) return errorResponse('FORBIDDEN', 'Access denied to property', 403);
    if (!(await hasPermission(session.user.id, 'laundry', 'update', item.propertyId))) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.basePrice !== undefined && Number.isFinite(Number(body.basePrice)) && Number(body.basePrice) >= 0) data.basePrice = Number(body.basePrice);
    if (typeof body.category === 'string' || body.category === null) data.category = body.category || null;
    if (typeof body.description === 'string' || body.description === null) data.description = body.description || null;
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (!Object.keys(data).length) return errorResponse('BAD_REQUEST', 'No valid catalog changes supplied', 400);

    const updated = await prisma.laundryItem.update({ where: { id }, data });
    return successResponse(updated);
  } catch (error) {
    console.error('[LaundryItems PATCH]', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update laundry item', 500);
  }
}
