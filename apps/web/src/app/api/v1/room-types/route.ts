import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError, } from '@/lib/property-access';
import { requireOrganizationContext } from '@/lib/organization-access';
import { createRoomTypeSchema } from '@hotel-pms/types';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const allowed = (await requireOrganizationContext((session.user as any).id || (session as any).user.id)).propertyIds;
    const where: any = propertyId 
      ? { propertyId, isActive: true } 
      : { propertyId: { in: allowed as string[] }, isActive: true };

    if (propertyId && !allowed.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const body = await req.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
    const data = createRoomTypeSchema.parse(body);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(data.propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
