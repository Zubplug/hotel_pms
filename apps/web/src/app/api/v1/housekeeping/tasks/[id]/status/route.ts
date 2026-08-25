import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess } from '@/lib/property-access';

const VALID_TRANSITIONS: Record<string, string[]> = {
  'PENDING': ['ASSIGNED', 'CANCELLED'],
  'ASSIGNED': ['CLEANING', 'CANCELLED'],
  'CLEANING': ['CLEAN', 'MAINTENANCE_REQUIRED'],
  'CLEAN': ['INSPECTED', 'MAINTENANCE_REQUIRED'],
  'INSPECTED': [],
  'CANCELLED': [],
  'MAINTENANCE_REQUIRED': ['PENDING', 'ASSIGNED'] // Reset flow if maintenance fixes it
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    const { status, assignedTo } = await req.json();

    if (!status && !assignedTo) {
      return errorResponse('BAD_REQUEST', 'Provide status or assignedTo to update', 400);
    }

    const task = await prisma.housekeepingTask.findUnique({
      where: { id },
      include: { room: true }
    });

    if (!task) return errorResponse('NOT_FOUND', 'Task not found', 404);
    await assertPropertyAccess(session.user.id, task.propertyId);

    // Housekeeping task management is controlled by reception or management.
    const capabilities = (session.user as any).capabilities || [];
    const userRole = String((session.user as any).role || '').toUpperCase();
    const isReceptionist = userRole === 'RECEPTIONIST' || userRole === 'FRONT_DESK';
    const canManage = isReceptionist || capabilities.includes('ACCESS_MANAGEMENT') || await hasPermission(session.user.id, 'housekeeping', 'update', task.propertyId);
    if (!canManage) return errorResponse('FORBIDDEN', 'Only reception or management can update housekeeping tasks', 403);

    // Determine target status
    let targetStatus = status || task.status;
    if (!status && assignedTo && task.status === 'PENDING') {
      targetStatus = 'ASSIGNED'; // Auto-transition on assignment
    }

    // Validate State Machine
    if (targetStatus !== task.status) {
      const allowedNext = VALID_TRANSITIONS[task.status] || [];
      if (!allowedNext.includes(targetStatus)) {
        return errorResponse('INVALID_STATE', `Cannot transition task from ${task.status} to ${targetStatus}`, 409);
      }
    }

    // Atomic Transaction to synchronize Task and Room
    const updatedTask = await prisma.$transaction(async (tx: any) => {
      let roomStatusUpdate = undefined;
      let roomHskUpdate = targetStatus;

      // Sync Room status based on Task status
      if (targetStatus === 'CLEANING') roomStatusUpdate = 'CLEANING';
      if (targetStatus === 'CLEAN') roomStatusUpdate = 'CLEAN';
      if (targetStatus === 'INSPECTED') roomStatusUpdate = 'AVAILABLE';
      if (targetStatus === 'MAINTENANCE_REQUIRED') roomStatusUpdate = 'MAINTENANCE';

      const updateData: any = {
        status: targetStatus,
        ...(assignedTo !== undefined ? { assignedTo } : {})
      };

      if (targetStatus === 'CLEANING' && task.status !== 'CLEANING') updateData.startedAt = new Date();
      if (targetStatus === 'CLEAN' && task.status !== 'CLEAN') updateData.completedAt = new Date();
      if (targetStatus === 'INSPECTED') {
        updateData.inspectedAt = new Date();
        updateData.inspectedBy = session.user.id;
      }

      const hTask = await tx.housekeepingTask.update({
        where: { id },
        data: updateData
      });

      // Synchronise Room
      if (roomStatusUpdate || roomHskUpdate) {
        await tx.room.update({
          where: { id: task.roomId },
          data: {
            ...(roomStatusUpdate ? { status: roomStatusUpdate as any } : {}),
            housekeepingStatus: roomHskUpdate as any
          }
        });
      }

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: (await tx.property.findUnique({ where: { id: task.propertyId } }))?.organizationId || '',
          propertyId: task.propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: (session.user as any).role || 'STAFF',
          action: 'HOUSEKEEPING_TASK_UPDATED',
          resource: 'HousekeepingTask',
          resourceId: task.id,
          newValue: { status: targetStatus, assignedTo },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        }
      });

      return hTask;
    });

    return successResponse(updatedTask);
  } catch (err: any) {
    console.error('[HousekeepingTaskStatus PATCH]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
