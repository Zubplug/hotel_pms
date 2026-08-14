import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    const operation = await prisma.lockOperation.findUnique({ where: { id } });
    
    if (!operation) return errorResponse('NOT_FOUND', 'Operation not found', 404);

    return successResponse({ 
      status: operation.status, 
      errorMessage: operation.errorMessage 
    });
  } catch (err) {
    console.error('[Operation GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
