import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);

    const { productId } = params;
    if (!productId) return errorResponse('BAD_REQUEST', 'Product ID is required', 400);

    const body = await req.json();
    const { productionStation, name, price, isActive } = body;

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
