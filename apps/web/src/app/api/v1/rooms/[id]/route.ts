import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { updateRoomSchema } from '@hotel-pms/types';
import { requireOrganizationContext } from "@/lib/organization-access";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const { id } = await params;
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        roomType: true,
        building: true,
        floor: true,
        doorLocks: true,
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!room || room.deletedAt) return errorResponse('NOT_FOUND', 'Room not found', 404);
    await assertPropertyAccess(session.user.id, room.propertyId);
    return successResponse(room);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const { id } = await params;
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room || room.deletedAt) return errorResponse('NOT_FOUND', 'Room not found', 404);
    await assertPropertyAccess(session.user.id, room.propertyId);
    const canUpdate = await hasPermission(session.user.id, 'room', 'update', room.propertyId);
    if (!canUpdate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    const body = await req.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
    const data = updateRoomSchema.parse(body);
    const updated = await prisma.room.update({ where: { id }, data: data as any, include: { roomType: true } });
    const property = await prisma.property.findUnique({ where: { id: room.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: room.propertyId, userId: session.user.id,
      action: 'UPDATE', resource: 'room', resourceId: id, previousValue: room, newValue: updated,
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
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const { id } = await params;
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room || room.deletedAt) return errorResponse('NOT_FOUND', 'Room not found', 404);
    await assertPropertyAccess(session.user.id, room.propertyId);
    const canDelete = await hasPermission(session.user.id, 'room', 'delete', room.propertyId);
    if (!canDelete) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    await prisma.room.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    const property = await prisma.property.findUnique({ where: { id: room.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: room.propertyId, userId: session.user.id,
      action: 'DELETE', resource: 'room', resourceId: id, previousValue: room,
    });
    return successResponse({ id });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
