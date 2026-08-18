import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { categoryId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);

    const { categoryId } = params;
    if (!categoryId) return errorResponse('BAD_REQUEST', 'Category ID is required', 400);

    const body = await req.json();
    const { productionStation, name, isActive } = body;

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
