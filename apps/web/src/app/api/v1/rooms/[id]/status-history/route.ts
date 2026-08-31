import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { requireOrganizationContext } from "@/lib/organization-access";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const { id } = await params;
    const room = await prisma.room.findUnique({ where: { id }, select: { propertyId: true, deletedAt: true } });
    if (!room || room.deletedAt) return errorResponse('NOT_FOUND', 'Room not found', 404);
    await assertPropertyAccess(session.user.id, room.propertyId);
    const canView = await hasPermission(session.user.id, 'room', 'view_history', room.propertyId);
    if (!canView) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '50'), 100);

    const [total, history] = await Promise.all([
      prisma.roomStatusHistory.count({ where: { roomId: id } }),
      prisma.roomStatusHistory.findMany({
        where: { roomId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return successResponse({ history, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
