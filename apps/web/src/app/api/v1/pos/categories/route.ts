import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const url = new URL(req.url);
    const propertyId = url.searchParams.get('propertyId');
    const outletId = url.searchParams.get('outletId');
    if (!propertyId) return errorResponse('BAD_REQUEST', 'Property ID is required', 400);

    let outletIdsToQuery = [];
    if (outletId) {
      outletIdsToQuery = [outletId];
    } else {
      // Categories are linked via outlet. Let's get outlets for this property first, then categories.
      const outlets = await prisma.posOutlet.findMany({
        where: { propertyId: { in: ctx.propertyIds as string[] }, isActive: true },
        select: { id: true }
      });
      outletIdsToQuery = outlets.map((o: any) => o.id);
    }

    const categories = await prisma.productCategory.findMany({
      where: { outletId: { in: outletIdsToQuery }, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    return successResponse(categories);
  } catch (err) {
    console.error('[POS Categories GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
