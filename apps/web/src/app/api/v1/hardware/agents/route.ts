import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const allowed = await getUserPropertyIds(session.user.id);
    if (allowed.length === 0) return successResponse([]);

    const agents = await prisma.hardwareAgent.findMany({
      where: { propertyId: { in: allowed } },
      include: { property: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(agents);
  } catch (err) {
    console.error('[HardwareAgents GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
