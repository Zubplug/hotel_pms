import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { assertPropertyAccess } from '@/lib/property-access';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse('UNAUTHORIZED', 'Not authenticated', 401);
    }

    const { id } = await params;

    const operation = await prisma.lockOperation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        errorCode: true,
        errorMessage: true,
        propertyId: true,
        command: {
          select: {
            payload: true,
            responseData: true
          }
        }
      }
    });

    if (!operation) {
      return errorResponse('NOT_FOUND', 'Lock operation not found', 404);
    }

    try {
      await assertPropertyAccess(session.user.id, operation.propertyId);
    } catch {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    return successResponse({ operation });

  } catch (err) {
    console.error('[Operations GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching operation', 500);
  }
}
