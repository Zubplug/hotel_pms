import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { updateAmenitySchema } from '@hotel-pms/types';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const amenity = await prisma.amenity.findUnique({ where: { id } });
    if (!amenity) return errorResponse('NOT_FOUND', 'Amenity not found', 404);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(amenity.propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const canUpdate = await hasPermission(session.user.id, 'amenity', 'update', amenity.propertyId);
    if (!canUpdate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    const body = await req.json();
    const data = updateAmenitySchema.parse(body);
    const updated = await prisma.amenity.update({ where: { id }, data });
    const property = await prisma.property.findUnique({ where: { id: amenity.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: amenity.propertyId, userId: session.user.id,
      action: 'UPDATE', resource: 'amenity', resourceId: id, previousValue: amenity, newValue: updated,
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
    const amenity = await prisma.amenity.findUnique({ where: { id } });
    if (!amenity) return errorResponse('NOT_FOUND', 'Amenity not found', 404);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(amenity.propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const canDelete = await hasPermission(session.user.id, 'amenity', 'delete', amenity.propertyId);
    if (!canDelete) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    await prisma.amenity.delete({ where: { id } });
    return successResponse({ id });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
