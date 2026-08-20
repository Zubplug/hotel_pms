import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { verifyMobileToken } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req);
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const cursor = searchParams.get('cursor'); // notification ID
    const category = searchParams.get('category'); // 'Finance', 'Operations', etc.

    // Base query logic
    const whereClause: any = {
      recipientId: session.id,
      channel: 'in_app',
    };

    if (category && category !== 'All') {
      if (category === 'Critical') {
        whereClause.priority = { in: ['Critical', 'High'] };
      } else {
        whereClause.category = category;
      }
    }

    const queryArgs: any = {
      take: limit + 1, // Fetch one extra to determine if there's a next page
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    };

    if (cursor) {
      queryArgs.cursor = { id: cursor };
      // skip the cursor itself if we are paginating
      queryArgs.skip = 1;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany(queryArgs),
      prisma.notification.count({
        where: {
          recipientId: session.id,
          channel: 'in_app',
          readAt: null,
        },
      }),
    ]);

    let nextCursor: string | null = null;
    if (notifications.length > limit) {
      const nextItem = notifications.pop();
      nextCursor = nextItem!.id;
    }

    return successResponse({
      data: notifications,
      meta: {
        nextCursor,
        unreadCount,
      },
    }, 200);

  } catch (err: any) {
    console.error('[Notifications GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch notifications', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req);
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { action, notificationId } = body as { action?: string; notificationId?: string };

    if (!action) {
      return errorResponse('BAD_REQUEST', 'Missing action payload', 400);
    }

    if (action === 'mark_all_read') {
      await prisma.notification.updateMany({
        where: {
          recipientId: session.id,
          channel: 'in_app',
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });
      return successResponse({ success: true }, 200);
    }

    if (action === 'mark_read') {
      if (!notificationId) {
        return errorResponse('BAD_REQUEST', 'Missing notificationId', 400);
      }

      // Important: Use updateMany to safely enforce recipientId RBAC. 
      // If the notification belongs to someone else, updateMany will simply match 0 rows.
      const result = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          recipientId: session.id,
        },
        data: {
          readAt: new Date(),
        },
      });

      if (result.count === 0) {
        return errorResponse('NOT_FOUND', 'Notification not found or access denied', 404);
      }

      return successResponse({ success: true }, 200);
    }

    return errorResponse('BAD_REQUEST', 'Invalid action', 400);

  } catch (err: any) {
    console.error('[Notifications POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to process notification action', 500);
  }
}
