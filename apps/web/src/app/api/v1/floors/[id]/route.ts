import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { updateFloorSchema } from '@hotel-pms/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const floor = await prisma.floor.findUnique({ where: { id }, include: { _count: { select: { rooms: true } } } });
    if (!floor) return errorResponse('NOT_FOUND', 'Floor not found', 404);
    await assertPropertyAccess(session.user.id, floor.propertyId);
    return successResponse(floor);
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
    const floor = await prisma.floor.findUnique({ where: { id } });
    if (!floor) return errorResponse('NOT_FOUND', 'Floor not found', 404);
    await assertPropertyAccess(session.user.id, floor.propertyId);
    const canUpdate = await hasPermission(session.user.id, 'floor', 'update', floor.propertyId);
    if (!canUpdate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    const body = await req.json();
    const data = updateFloorSchema.parse(body);
    if (data.number !== undefined && data.number !== floor.number) {
      const exists = await prisma.floor.findUnique({
        where: { buildingId_number: { buildingId: floor.buildingId, number: data.number } },
      });
      if (exists) return errorResponse('FLOOR_NUMBER_DUPLICATE', `Floor ${data.number} already exists in this building`, 409);
    }
    const updated = await prisma.floor.update({ where: { id }, data });
    const property = await prisma.property.findUnique({ where: { id: floor.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: floor.propertyId, userId: session.user.id,
      action: 'UPDATE', resource: 'floor', resourceId: id, previousValue: floor, newValue: updated,
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
    const floor = await prisma.floor.findUnique({ where: { id } });
    if (!floor) return errorResponse('NOT_FOUND', 'Floor not found', 404);
    await assertPropertyAccess(session.user.id, floor.propertyId);
    const canDelete = await hasPermission(session.user.id, 'floor', 'delete', floor.propertyId);
    if (!canDelete) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    await prisma.floor.update({ where: { id }, data: { isActive: false } });
    return successResponse({ id });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
