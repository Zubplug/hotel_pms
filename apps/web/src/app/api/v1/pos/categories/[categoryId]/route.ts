import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from "@/lib/organization-access";

const MENU_ROLES = ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    if (!MENU_ROLES.includes((session.user as any).role) && !(session.user as any).isSuperAdmin) return errorResponse('FORBIDDEN', 'F&B management access required', 403);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    if (!categoryId) return errorResponse('BAD_REQUEST', 'Category ID is required', 400);

    const body = await req.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
        let reqOutletId = body?.outletId;
        if (reqOutletId && !ctx.outletIds.includes(reqOutletId)) return NextResponse.json({ error: 'Forbidden outlet' }, { status: 403 });
    const { productionStation, name, isActive } = body;
    const category = await prisma.productCategory.findUnique({ where: { id: categoryId }, include: { outlet: { select: { propertyId: true } } } });
    if (!category || !ctx.propertyIds.includes(category.outlet.propertyId)) return errorResponse('NOT_FOUND', 'Category not found', 404);

    // Validate productionStation if provided
    const validStations = ['KITCHEN', 'BAR', 'DIRECT', 'NONE'];
    if (productionStation !== undefined && !validStations.includes(productionStation)) {
      return errorResponse('BAD_REQUEST', `Invalid productionStation. Must be one of: ${validStations.join(', ')}`, 400);
    }

    const data: Record<string, unknown> = {};
    if (productionStation !== undefined) data.productionStation = productionStation;
    if (name !== undefined) data.name = name;
    if (isActive !== undefined) data.isActive = isActive;

    if (Object.keys(data).length === 0) {
      return errorResponse('BAD_REQUEST', 'No fields to update', 400);
    }

    const updated = await prisma.productCategory.update({
      where: { id: categoryId },
      data,
    });

    return successResponse(updated);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return errorResponse('NOT_FOUND', 'Category not found', 404);
    }
    console.error('[POS Category PATCH]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
