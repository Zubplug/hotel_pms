import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { updateRoomTypeSchema } from '@hotel-pms/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const rt = await prisma.roomType.findUnique({ where: { id }, include: { _count: { select: { rooms: true } } } });
    if (!rt) return errorResponse('NOT_FOUND', 'Room type not found', 404);
    await assertPropertyAccess(session.user.id, rt.propertyId);
    return successResponse(rt);
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
    const rt = await prisma.roomType.findUnique({ where: { id } });
    if (!rt) return errorResponse('NOT_FOUND', 'Room type not found', 404);
    await assertPropertyAccess(session.user.id, rt.propertyId);
    const canUpdate = await hasPermission(session.user.id, 'room_type', 'update', rt.propertyId);
    if (!canUpdate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    const body = await req.json();
    const data = updateRoomTypeSchema.parse(body);
    const updated = await prisma.roomType.update({ where: { id }, data: { ...data, baseRate: data.baseRate } });
    const property = await prisma.property.findUnique({ where: { id: rt.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: rt.propertyId, userId: session.user.id,
      action: 'UPDATE', resource: 'room_type', resourceId: id, previousValue: rt, newValue: updated,
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
    const rt = await prisma.roomType.findUnique({ where: { id } });
    if (!rt) return errorResponse('NOT_FOUND', 'Room type not found', 404);
    await assertPropertyAccess(session.user.id, rt.propertyId);
    const canDelete = await hasPermission(session.user.id, 'room_type', 'delete', rt.propertyId);
    if (!canDelete) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    await prisma.roomType.update({ where: { id }, data: { isActive: false } });
    return successResponse({ id });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
