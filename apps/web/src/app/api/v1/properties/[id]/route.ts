import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, NotFoundError, ForbiddenError } from '@/lib/property-access';
import { updatePropertySchema } from '@hotel-pms/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    await assertPropertyAccess(session.user.id, id);

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        buildings: { include: { floors: true, _count: { select: { rooms: true } } } },
        _count: { select: { rooms: true, roomTypes: true } },
      },
    });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    return successResponse(property);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    if (err instanceof NotFoundError) return errorResponse('NOT_FOUND', err.message, 404);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    await assertPropertyAccess(session.user.id, id);
    const canUpdate = await hasPermission(session.user.id, 'property', 'update', id);
    if (!canUpdate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const body = await req.json();
    const data = updatePropertySchema.parse(body);
    const updated = await prisma.property.update({ where: { id }, data: data as any });

    await createAuditLog({
      organizationId: property.organizationId,
      propertyId: id,
      userId: session.user.id,
      action: 'UPDATE',
      resource: 'property',
      resourceId: id,
      previousValue: property,
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
    await assertPropertyAccess(session.user.id, id);
    const canDelete = await hasPermission(session.user.id, 'property', 'delete', id);
    if (!canDelete) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    await prisma.property.update({ where: { id }, data: { deletedAt: new Date() } });

    await createAuditLog({
      organizationId: property.organizationId,
      propertyId: id,
      userId: session.user.id,
      action: 'DELETE',
      resource: 'property',
      resourceId: id,
      previousValue: property,
    });

    return successResponse({ id });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
