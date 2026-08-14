import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { createFloorSchema } from '@hotel-pms/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id: buildingId } = await params;
    const building = await prisma.building.findUnique({ where: { id: buildingId } });
    if (!building) return errorResponse('NOT_FOUND', 'Building not found', 404);
    await assertPropertyAccess(session.user.id, building.propertyId);
    const floors = await prisma.floor.findMany({
      where: { buildingId },
      include: { _count: { select: { rooms: true } } },
      orderBy: { number: 'asc' },
    });
    return successResponse(floors);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id: buildingId } = await params;
    const building = await prisma.building.findUnique({ where: { id: buildingId } });
    if (!building) return errorResponse('NOT_FOUND', 'Building not found', 404);
    await assertPropertyAccess(session.user.id, building.propertyId);
    const canCreate = await hasPermission(session.user.id, 'floor', 'create', building.propertyId);
    if (!canCreate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const body = await req.json();
    const data = createFloorSchema.parse({ ...body, buildingId, propertyId: building.propertyId });

    // Check duplicate floor number
    const exists = await prisma.floor.findUnique({
      where: { buildingId_number: { buildingId, number: data.number } },
    });
    if (exists) return errorResponse('FLOOR_NUMBER_DUPLICATE', `Floor ${data.number} already exists in this building`, 409);

    const floor = await prisma.floor.create({ data });
    const property = await prisma.property.findUnique({ where: { id: building.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId,
      propertyId: building.propertyId,
      userId: session.user.id,
      action: 'CREATE',
      resource: 'floor',
      resourceId: floor.id,
      newValue: floor,
    });
    return successResponse(floor, 201);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    if (err instanceof Error && err.name === 'ZodError') return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
