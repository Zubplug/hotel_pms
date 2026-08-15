import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { paginatedResponse, errorResponse, successResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError, getUserPropertyIds } from '@/lib/property-access';
import { createRoomSchema, roomQuerySchema } from '@hotel-pms/types';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const query = roomQuerySchema.parse({
      propertyId: searchParams.get('propertyId') ?? undefined,
      buildingId: searchParams.get('buildingId') ?? undefined,
      floorId: searchParams.get('floorId') ?? undefined,
      roomTypeId: searchParams.get('roomTypeId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      housekeepingStatus: searchParams.get('housekeepingStatus') ?? undefined,
      isActive: searchParams.get('isActive') === 'true' ? true : searchParams.get('isActive') === 'false' ? false : undefined,
      search: searchParams.get('search') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortOrder: searchParams.get('sortOrder') ?? undefined,
    });

    const allowed = await getUserPropertyIds(session.user.id);
    if (query.propertyId) await assertPropertyAccess(session.user.id, query.propertyId);

    const where = {
      propertyId: query.propertyId ? query.propertyId : { in: allowed },
      ...(query.buildingId ? { buildingId: query.buildingId } : {}),
      ...(query.floorId ? { floorId: query.floorId } : {}),
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.housekeepingStatus ? { housekeepingStatus: query.housekeepingStatus as any } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search ? {
        OR: [
          { number: { contains: query.search, mode: 'insensitive' as const } },
          { displayName: { contains: query.search, mode: 'insensitive' as const } },
          { code: { contains: query.search, mode: 'insensitive' as const } },
        ],
      } : {}),
      deletedAt: null,
    };

    const sortField: Record<string, unknown> = {
      number: { number: query.sortOrder },
      status: { status: query.sortOrder },
      roomType: { roomType: { name: query.sortOrder } },
      floor: { floor: { number: query.sortOrder } },
      createdAt: { createdAt: query.sortOrder },
    };

    const [total, rooms] = await Promise.all([
      prisma.room.count({ where }),
      prisma.room.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: sortField[query.sortBy] as never,
        include: {
          roomType: { select: { name: true, code: true } },
          building: { select: { name: true } },
          floor: { select: { name: true, number: true } },
        },
      }),
    ]);

    return paginatedResponse(rooms, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    if (err instanceof Error && err.name === 'ZodError') return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const body = await req.json();
    const data = createRoomSchema.parse(body);
    await assertPropertyAccess(session.user.id, data.propertyId);
    const canCreate = await hasPermission(session.user.id, 'room', 'create', data.propertyId);
    if (!canCreate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    // Check room number uniqueness within property
    const existing = await prisma.room.findUnique({
      where: { propertyId_number: { propertyId: data.propertyId, number: data.number } },
    });
    if (existing) return errorResponse('ROOM_NUMBER_DUPLICATE', `Room ${data.number} already exists in this property`, 409);

    const room = await prisma.room.create({
      data: { ...data, squareMeters: data.squareMeters } as any,
      include: { roomType: true, building: true, floor: true },
    });

    const property = await prisma.property.findUnique({ where: { id: data.propertyId }, select: { organizationId: true } });
    await createAuditLog({
      organizationId: property!.organizationId, propertyId: data.propertyId, userId: session.user.id,
      action: 'CREATE', resource: 'room', resourceId: room.id, newValue: room,
    });

    // Create initial status history
    await prisma.roomStatusHistory.create({
      data: {
        roomId: room.id,
        propertyId: data.propertyId,
        previousStatus: data.status ?? 'AVAILABLE',
        newStatus: data.status ?? 'AVAILABLE',
        source: 'SYSTEM',
        changedBy: session.user.id,
        reason: 'Room created',
      },
    });

    return successResponse(room, 201);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    if (err instanceof Error && err.name === 'ZodError') return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
