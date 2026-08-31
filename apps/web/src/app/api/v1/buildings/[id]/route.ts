import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { updateBuildingSchema } from '@hotel-pms/types';
import { requireOrganizationContext } from "@/lib/organization-access";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const { id } = await params;
    const building = await prisma.building.findUnique({
      where: { id },
      include: { floors: { orderBy: { number: 'asc' } }, _count: { select: { rooms: true } } },
    });
    if (!building) return errorResponse('NOT_FOUND', 'Building not found', 404);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(building.propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return successResponse(building);
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
    const building = await prisma.building.findUnique({ where: { id } });
    if (!building) return errorResponse('NOT_FOUND', 'Building not found', 404);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(building.propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const canUpdate = await hasPermission(session.user.id, 'building', 'update', building.propertyId);
    if (!canUpdate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const body = await req.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
    const data = updateBuildingSchema.parse(body);
    const updated = await prisma.building.update({ where: { id }, data });

    const property = await prisma.property.findUnique({ where: { id: building.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId,
      propertyId: building.propertyId,
      userId: session.user.id,
      action: 'UPDATE',
      resource: 'building',
      resourceId: id,
      previousValue: building,
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
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const { id } = await params;
    const building = await prisma.building.findUnique({ where: { id } });
    if (!building) return errorResponse('NOT_FOUND', 'Building not found', 404);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(building.propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const canDelete = await hasPermission(session.user.id, 'building', 'delete', building.propertyId);
    if (!canDelete) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    await prisma.building.update({ where: { id }, data: { isActive: false } });
    return successResponse({ id });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
