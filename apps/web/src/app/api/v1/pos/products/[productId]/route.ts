import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    if (!productId) return errorResponse('BAD_REQUEST', 'Product ID is required', 400);

    const body = await req.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
        let reqOutletId = body?.outletId;
        if (reqOutletId && !ctx.outletIds.includes(reqOutletId)) return NextResponse.json({ error: 'Forbidden outlet' }, { status: 403 });
    const { productionStation, name, price, isActive, inventoryMode } = body;
    const role = String((session.user as any).role || '').toUpperCase();
    if (price !== undefined && !['MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'].includes(role) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Selling price changes require the approval workflow', 403);
    }
    if (['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'].includes(role) && Object.keys(body).some((key) => key !== 'price')) {
      return errorResponse('FORBIDDEN', 'Cashiers may only request selling-price changes', 403);
    }

    // Validate productionStation if provided (null means "inherit from category")
    const validStations = ['KITCHEN', 'BAR', 'DIRECT', 'NONE'];
    if (
      productionStation !== undefined &&
      productionStation !== null &&
      !validStations.includes(productionStation)
    ) {
      return errorResponse('BAD_REQUEST', `Invalid productionStation. Must be one of: ${validStations.join(', ')} or null`, 400);
    }

    const data: Record<string, unknown> = {};
    if ('productionStation' in body) data.productionStation = productionStation ?? null;
    if (name !== undefined) data.name = name;
    if (price !== undefined) data.price = price;
    if (isActive !== undefined) data.isActive = isActive;
    if (inventoryMode !== undefined) {
      if (!['STOCK', 'NON_STOCK'].includes(String(inventoryMode).toUpperCase())) return errorResponse('BAD_REQUEST', 'inventoryMode must be STOCK or NON_STOCK', 400);
      data.inventoryMode = String(inventoryMode).toUpperCase();
    }

    if (Object.keys(data).length === 0) {
      return errorResponse('BAD_REQUEST', 'No fields to update', 400);
    }

    const updated = await prisma.posProduct.update({
      where: { id: productId },
      data,
    });

    return successResponse(updated);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return errorResponse('NOT_FOUND', 'Product not found', 404);
    }
    console.error('[POS Product PATCH]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
