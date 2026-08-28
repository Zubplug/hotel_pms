import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { isValidTransition } from '@/lib/room-state-machine';
import { roomStatusTransitionSchema } from '@hotel-pms/types';
import { NotificationEngine } from '@/lib/notification-engine';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room || room.deletedAt) return errorResponse('NOT_FOUND', 'Room not found', 404);
    await assertPropertyAccess(session.user.id, room.propertyId);
    const canChangeStatus = await hasPermission(session.user.id, 'room', 'change_status', room.propertyId);
    if (!canChangeStatus) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const body = await req.json();
    const { newStatus, reason, source, referenceId } = roomStatusTransitionSchema.parse(body);

    if (newStatus === 'AVAILABLE' && ['DIRTY', 'MAINTENANCE', 'OUT_OF_ORDER'].includes(room.status)) {
      return errorResponse(
        'HOUSEKEEPING_REQUIRED',
        'This room must be cleared by maintenance and/or housekeeping before it becomes Available.',
        422
      );
    }

    // STATE MACHINE ENFORCEMENT — server-side, non-bypassable
    if (!isValidTransition(room.status, newStatus)) {
      return errorResponse(
        'ROOM_STATUS_TRANSITION_INVALID',
        `Room ${room.number} cannot transition from ${room.status} to ${newStatus}.`,
        422
      );
    }

    // Execute in a transaction to keep room + history in sync
    const updatedRoom = await prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === 'DIRTY' ? { housekeepingStatus: 'PENDING' } : {}),
        },
        include: { roomType: true, building: true, floor: true },
      });
      await tx.roomStatusHistory.create({
        data: {
          roomId: id,
          propertyId: room.propertyId,
          previousStatus: room.status,
          newStatus,
          source,
          referenceId,
          changedBy: session.user.id,
          reason,
        },
      });
      if (newStatus === 'DIRTY') {
        await tx.housekeepingTask.create({
          data: {
            propertyId: room.propertyId,
            roomId: room.id,
            type: 'INSPECTION',
            priority: 'NORMAL',
            status: 'PENDING',
            businessDate: new Date(new Date().setUTCHours(0, 0, 0, 0)),
            idempotencyKey: `ROOM_DIRTY_${room.id}_${Date.now()}`,
            notes: reason || 'Room marked Dirty and requires housekeeping attention.',
          },
        });
      }
      return updated;
    });

    const property = await prisma.property.findUnique({ where: { id: room.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: room.propertyId, userId: session.user.id,
      action: 'ROOM_STATUS_CHANGE', resource: 'room', resourceId: id,
      previousValue: { status: room.status }, newValue: { status: newStatus, reason },
    });

    if (newStatus === 'OUT_OF_ORDER') {
      await NotificationEngine.emit({
        type: 'ROOM_OOO_CRITICAL',
        organizationId: property!.organizationId,
        propertyId: room.propertyId,
        entityType: 'room',
        entityId: id,
        idempotencyKey: `room_ooo_${id}_${Date.now()}`
      });
    }

    return successResponse(updatedRoom);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    if (err instanceof Error && err.name === 'ZodError') return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
