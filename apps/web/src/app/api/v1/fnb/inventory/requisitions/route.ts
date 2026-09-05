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

    const { propertyId, fromWarehouseId, toWarehouseId, items } = await req.json();

    if (!propertyId || !fromWarehouseId || !toWarehouseId || !items || !items.length) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;

    if (!allowedPropertyIds.includes(propertyId) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    // Create a strict internal requisition (draft state)
    const requisition = await prisma.stockTransfer.create({
      data: {
        propertyId,
        fromWarehouseId,
        toWarehouseId,
        transferRef: `REQ-${Date.now()}`,
        status: 'DRAFT',
        requestedBy: session.user.id,
        items: {
          create: items.map((item: any) => ({
            stockItemId: item.itemId,
            quantity: item.quantity,
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
      message: 'Requisition draft created successfully'
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
    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;

    if (requestedPropertyId && !allowedPropertyIds.includes(requestedPropertyId) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const propertyIdsToQuery = requestedPropertyId ? [requestedPropertyId] : allowedPropertyIds;

    const requisitions = await prisma.stockTransfer.findMany({
      where: {
        propertyId: { in: propertyIdsToQuery as string[] }
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { stockItem: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return successResponse({
      requisitions
    }, 200);
  } catch (err: any) {
    console.error('[FNB Requisitions GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching requisitions', 500);
  }
}
