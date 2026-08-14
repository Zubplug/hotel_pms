import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { updateBuildingSchema } from '@hotel-pms/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const building = await prisma.building.findUnique({
      where: { id },
      include: { floors: { orderBy: { number: 'asc' } }, _count: { select: { rooms: true } } },
    });
    if (!building) return errorResponse('NOT_FOUND', 'Building not found', 404);
    await assertPropertyAccess(session.user.id, building.propertyId);
    return successResponse(building);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const building = await prisma.building.findUnique({ where: { id } });
    if (!building) return errorResponse('NOT_FOUND', 'Building not found', 404);
    await assertPropertyAccess(session.user.id, building.propertyId);
    const canUpdate = await hasPermission(session.user.id, 'building', 'update', building.propertyId);
    if (!canUpdate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const body = await req.json();
    const data = updateBuildingSchema.parse(body);
    const updated = await prisma.building.update({ where: { id }, data });

    const property = await prisma.property.findUnique({ where: { id: building.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId,
      propertyId: building.propertyId,
      userId: session.user.id,
      action: 'UPDATE',
      resource: 'building',
      resourceId: id,
      previousValue: building,
      newValue: updated,
    });
    return successResponse(updated);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    if (err instanceof Error && err.name === 'ZodError') return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const building = await prisma.building.findUnique({ where: { id } });
    if (!building) return errorResponse('NOT_FOUND', 'Building not found', 404);
    await assertPropertyAccess(session.user.id, building.propertyId);
    const canDelete = await hasPermission(session.user.id, 'building', 'delete', building.propertyId);
    if (!canDelete) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    await prisma.building.update({ where: { id }, data: { isActive: false } });
    return successResponse({ id });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
