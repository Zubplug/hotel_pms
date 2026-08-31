import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { createBuildingSchema } from '@hotel-pms/types';
import { requireOrganizationContext } from "@/lib/organization-access";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const { id: propertyId } = await params;
    await assertPropertyAccess(session.user.id, propertyId);

    const buildings = await prisma.building.findMany({
      where: { propertyId: { in: ctx.propertyIds as string[] } },
      include: { floors: { orderBy: { number: 'asc' } }, _count: { select: { rooms: true } } },
      orderBy: { name: 'asc' },
    });
    return successResponse(buildings);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const { id: propertyId } = await params;
    await assertPropertyAccess(session.user.id, propertyId);
    const canCreate = await hasPermission(session.user.id, 'building', 'create', propertyId);
    if (!canCreate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const body = await req.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
    const data = createBuildingSchema.parse({ ...body, propertyId: (typeof reqPropertyId !== "undefined" ? reqPropertyId : ctx.propertyIds[0]) });
    const building = await prisma.building.create({ data });

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId,
      propertyId: (typeof reqPropertyId !== "undefined" ? reqPropertyId : ctx.propertyIds[0]),
      userId: session.user.id,
      action: 'CREATE',
      resource: 'building',
      resourceId: building.id,
      newValue: building,
    });

    return successResponse(building, 201);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    if (err instanceof Error && err.name === 'ZodError') return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
