import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError, getUserPropertyIds } from '@/lib/property-access';
import { createAmenitySchema } from '@hotel-pms/types';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    if (propertyId) await assertPropertyAccess(session.user.id, propertyId);
    const allowed = await getUserPropertyIds(session.user.id);
    const where = { propertyId: propertyId ? propertyId : { in: allowed } };
    const amenities = await prisma.amenity.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    return successResponse(amenities);
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
    const data = createAmenitySchema.parse(body);
    await assertPropertyAccess(session.user.id, data.propertyId);
    const canCreate = await hasPermission(session.user.id, 'amenity', 'create', data.propertyId);
    if (!canCreate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    const amenity = await prisma.amenity.create({ data });
    const property = await prisma.property.findUnique({ where: { id: data.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: data.propertyId, userId: session.user.id,
      action: 'CREATE', resource: 'amenity', resourceId: amenity.id, newValue: amenity,
    });
    return successResponse(amenity, 201);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    if (err instanceof Error && err.name === 'ZodError') return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
