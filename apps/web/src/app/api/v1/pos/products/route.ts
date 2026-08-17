import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);

    const url = new URL(req.url);
    const propertyId = url.searchParams.get('propertyId');
    if (!propertyId) return errorResponse('BAD_REQUEST', 'Property ID is required', 400);

    const products = await prisma.posProduct.findMany({
      where: { propertyId, isActive: true }
    });

    return successResponse(products);
  } catch (err) {
    console.error('[POS Products GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
