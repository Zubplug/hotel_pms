import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search') ?? '';
    const propertyId = searchParams.get('propertyId');
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 50)));
    const paged = searchParams.get('paged') === 'true';
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? limit)));
    if (propertyId && !ctx.propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const where = {
        organizationId: ctx.organizationId,
        propertyId: propertyId ? propertyId : { in: [...ctx.propertyIds] },
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
    const guests = await prisma.guest.findMany({
      where,
      orderBy: { lastName: 'asc' },
      ...(paged ? { skip: (page - 1) * pageSize, take: pageSize } : { take: limit }),
    });

    if (paged) {
      const total = await prisma.guest.count({ where });
      return paginatedResponse(guests, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
    }
    return successResponse(guests);
  } catch (err) {
    console.error('[Guests GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
