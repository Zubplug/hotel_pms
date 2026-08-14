import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';

type Params = { params: Promise<{ id: string; blockId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id, blockId } = await params;
    const room = await prisma.room.findUnique({ where: { id }, select: { propertyId: true, deletedAt: true } });
    if (!room || room.deletedAt) return errorResponse('NOT_FOUND', 'Room not found', 404);
    await assertPropertyAccess(session.user.id, room.propertyId);
    const canManage = await hasPermission(session.user.id, 'room', 'manage_blocks', room.propertyId);
    if (!canManage) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    const block = await prisma.roomBlock.findUnique({ where: { id: blockId } });
    if (!block || block.roomId !== id) return errorResponse('NOT_FOUND', 'Block not found', 404);
    await prisma.roomBlock.update({ where: { id: blockId }, data: { status: 'CANCELLED' } });
    const property = await prisma.property.findUnique({ where: { id: room.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: room.propertyId, userId: session.user.id,
      action: 'CANCEL', resource: 'room_block', resourceId: blockId, previousValue: block,
    });
    return successResponse({ id: blockId });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
