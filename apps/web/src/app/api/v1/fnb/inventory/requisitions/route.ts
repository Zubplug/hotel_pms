import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId, fromWarehouseId, toWarehouseId, items, requestId, action } = body;

    if (!propertyId || !fromWarehouseId || !toWarehouseId || !items || !items.length || !requestId) {
      return errorResponse('BAD_REQUEST', 'Missing required fields (including requestId for idempotency)', 400);
    }

    const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'GENERAL_CASHIER'].includes(role);

    if (!isGlobalAdmin && !ctx.propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    // 1. Idempotency Check
    const transferRef = `REQ-${requestId}`;
    const existingTransfer = await prisma.stockTransfer.findUnique({
      where: { transferRef },
      include: { items: { include: { stockItem: true } } }
    });

    if (existingTransfer) {
      return successResponse({
        requisition: existingTransfer,
        message: 'Requisition already created (Idempotent)'
      }, 200);
    }

    // 2. Validate Source Warehouse
    const sourceWarehouse = await prisma.warehouse.findFirst({
      where: { id: fromWarehouseId, propertyId }
    });
    if (!sourceWarehouse) return errorResponse('NOT_FOUND', 'Source warehouse not found', 404);

    // Security: Is it a Main Store? (posOutletId is null). If not, is the user authorized?
    // In a strict setup, F&B managers shouldn't request from other operational outlets unless authorized.
    if (!isGlobalAdmin && sourceWarehouse.posOutletId !== null && !ctx.outletIds.includes(sourceWarehouse.posOutletId)) {
       return errorResponse('FORBIDDEN', 'Cannot requisition from an unauthorized operational outlet.', 403);
    }

    // 3. Validate Destination Warehouse
    const destWarehouse = await prisma.warehouse.findFirst({
      where: { id: toWarehouseId, propertyId }
    });
    if (!destWarehouse) return errorResponse('NOT_FOUND', 'Destination warehouse not found', 404);

    if (!isGlobalAdmin) {
      if (!destWarehouse.posOutletId || !ctx.outletIds.includes(destWarehouse.posOutletId)) {
        return errorResponse('FORBIDDEN', 'Destination warehouse must belong to an outlet assigned to you.', 403);
      }
    }

    // 4. Validate Items
    for (const item of items) {
      if (!item.quantity || isNaN(Number(item.quantity)) || Number(item.quantity) <= 0) {
        return errorResponse('BAD_REQUEST', `Invalid quantity for item ${item.itemId}`, 400);
      }
      const stockItem = await prisma.stockItem.findFirst({
        where: { id: item.itemId, propertyId }
      });
      if (!stockItem) return errorResponse('BAD_REQUEST', `Stock item ${item.itemId} not found in this property`, 400);
    }

    const targetStatus = action === 'SUBMIT' ? 'PENDING_APPROVAL' : 'DRAFT';

    // 5. Create Requisition
    const requisition = await prisma.stockTransfer.create({
      data: {
        propertyId,
        fromWarehouseId,
        toWarehouseId,
        transferRef,
        status: targetStatus,
        requestedBy: session.user.id,
        items: {
          create: items.map((item: any) => ({
            stockItemId: item.itemId,
            quantity: Number(item.quantity),
            unitOfMeasure: item.unitOfMeasure || 'UNIT',
          }))
        }
      },
      include: {
        items: {
          include: {
            stockItem: true
          }
        }
      }
    });

    return successResponse({
      requisition,
      message: targetStatus === 'DRAFT' ? 'Requisition saved as draft.' : 'Requisition submitted for approval.'
    }, 201);
  } catch (err: any) {
    console.error('[FNB Requisitions POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error creating requisition', 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const requestedPropertyId = searchParams.get('propertyId');
    
    const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'GENERAL_CASHIER'].includes(role);

    if (requestedPropertyId && !isGlobalAdmin && !ctx.propertyIds.includes(requestedPropertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const propertyIdsToQuery = requestedPropertyId ? [requestedPropertyId] : ctx.propertyIds;

    const whereClause: any = {
      propertyId: { in: propertyIdsToQuery as string[] }
    };

    // Restrict visibility for FNB Managers
    if (!isGlobalAdmin) {
      whereClause.OR = [
        { fromWarehouse: { posOutletId: { in: ctx.outletIds as string[] } } },
        { toWarehouse: { posOutletId: { in: ctx.outletIds as string[] } } }
      ];
    }

    const requisitions = await prisma.stockTransfer.findMany({
      where: whereClause,
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { stockItem: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return successResponse({
      requisitions
    }, 200);
  } catch (err: any) {
    console.error('[FNB Requisitions GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching requisitions', 500);
  }
}
