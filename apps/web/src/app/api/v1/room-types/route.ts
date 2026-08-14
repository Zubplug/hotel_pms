import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError, getUserPropertyIds } from '@/lib/property-access';
import { createRoomTypeSchema } from '@hotel-pms/types';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const allowed = await getUserPropertyIds(session.user.id);
    const where = {
      propertyId: propertyId ? propertyId : { in: allowed },
      isActive: true,
    };
    if (propertyId) await assertPropertyAccess(session.user.id, propertyId);
    const roomTypes = await prisma.roomType.findMany({ where, orderBy: { name: 'asc' } });
    return successResponse(roomTypes);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const body = await req.json();
    const data = createRoomTypeSchema.parse(body);
    await assertPropertyAccess(session.user.id, data.propertyId);
    const canCreate = await hasPermission(session.user.id, 'room_type', 'create', data.propertyId);
    if (!canCreate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    const roomType = await prisma.roomType.create({ data: { ...data, baseRate: data.baseRate } });
    const property = await prisma.property.findUnique({ where: { id: data.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: data.propertyId, userId: session.user.id,
      action: 'CREATE', resource: 'room_type', resourceId: roomType.id, newValue: roomType,
    });
    return successResponse(roomType, 201);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    if (err instanceof Error && err.name === 'ZodError') return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
