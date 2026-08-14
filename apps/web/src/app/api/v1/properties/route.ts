import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { getUserPropertyIds } from '@/lib/property-access';
import { createPropertySchema, propertyQuerySchema } from '@hotel-pms/types';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const query = propertyQuerySchema.parse({
      search: searchParams.get('search') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });

    const allowed = await getUserPropertyIds(session.user.id);
    if (allowed.length === 0) return paginatedResponse([], { page: 1, pageSize: 20, total: 0, totalPages: 0 });

    const where = {
      id: { in: allowed },
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { code: { contains: query.search, mode: 'insensitive' as const } },
          { city: { contains: query.search, mode: 'insensitive' as const } },
        ]
      } : {}),
    };

    const [total, properties] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { name: 'asc' },
        include: { _count: { select: { rooms: true } } },
      }),
    ]);

    return paginatedResponse(properties, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    });
  } catch (err) {
    console.error('[Properties GET]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const canCreate = await hasPermission(session.user.id, 'property', 'create');
    if (!canCreate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const body = await req.json();
    const data = createPropertySchema.parse(body);

    const property = await prisma.property.create({ data: data as any });

    await createAuditLog({
      organizationId: data.organizationId,
      propertyId: property.id,
      userId: session.user.id,
      action: 'CREATE',
      resource: 'property',
      resourceId: property.id,
      newValue: property,
    });

    return successResponse(property, 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ZodError') {
      return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422, err);
    }
    console.error('[Properties POST]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
