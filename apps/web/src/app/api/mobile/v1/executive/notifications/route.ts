import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { prisma } from '@hotel-pms/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 'EXECUTIVE'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Executive access required', 403);
    }

    const allowedPropertyIds = user.allowedProperties;

    if (allowedPropertyIds.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    
    // Build query
    const whereClause: any = {
      propertyId: { in: allowedPropertyIds },
      // Assuming recipientType 'staff' maps to user or staff role
      // For now, fetch property-wide executive notifications
      recipientType: 'staff',
    };

    if (category && category !== 'ALL') {
      whereClause.category = category;
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'asc' }, // P0, P1, P2
        { createdAt: 'desc' }
      ],
      take: 50
    });

    return successResponse(notifications, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Notifications API]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching executive notifications', 500);
  }
}
