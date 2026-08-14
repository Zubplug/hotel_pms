import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { createRoomBlockSchema } from '@hotel-pms/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const room = await prisma.room.findUnique({ where: { id }, select: { propertyId: true, deletedAt: true } });
    if (!room || room.deletedAt) return errorResponse('NOT_FOUND', 'Room not found', 404);
    await assertPropertyAccess(session.user.id, room.propertyId);
    const blocks = await prisma.roomBlock.findMany({
      where: { roomId: id },
      orderBy: { startDate: 'desc' },
    });
    return successResponse(blocks);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const room = await prisma.room.findUnique({ where: { id }, select: { propertyId: true, deletedAt: true, number: true } });
    if (!room || room.deletedAt) return errorResponse('NOT_FOUND', 'Room not found', 404);
    await assertPropertyAccess(session.user.id, room.propertyId);
    const canManage = await hasPermission(session.user.id, 'room', 'manage_blocks', room.propertyId);
    if (!canManage) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const body = await req.json();
    const data = createRoomBlockSchema.parse({ ...body, roomId: id, propertyId: room.propertyId });

    // Application-level overlap check (DB constraint is the authoritative guard)
    const overlapping = await prisma.roomBlock.findFirst({
      where: {
        roomId: id,
        status: 'ACTIVE',
        AND: [
          { startDate: { lte: new Date(data.endDate) } },
          { endDate: { gte: new Date(data.startDate) } },
        ],
      },
    });
    if (overlapping) {
      return errorResponse('ROOM_UNAVAILABLE', `Room ${room.number} is already blocked from ${data.startDate} to ${data.endDate}`, 409);
    }

    let block;
    try {
      block = await prisma.roomBlock.create({
        data: {
          roomId: data.roomId,
          propertyId: data.propertyId,
          type: data.type as never,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          reason: data.reason,
          notes: data.notes,
          authorizedBy: session.user.id,
          status: 'ACTIVE',
        },
      });
    } catch (dbErr: unknown) {
      // Catch PostgreSQL exclusion constraint violation
      const pgErr = dbErr as { code?: string };
      if (pgErr?.code === '23P01') {
        return errorResponse('ROOM_UNAVAILABLE', `Room ${room.number} is unavailable for the requested dates (constraint violation)`, 409);
      }
      throw dbErr;
    }

    const property = await prisma.property.findUnique({ where: { id: room.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: room.propertyId, userId: session.user.id,
      action: 'CREATE', resource: 'room_block', resourceId: block.id, newValue: block,
    });
    return successResponse(block, 201);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    if (err instanceof Error && err.name === 'ZodError') return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
