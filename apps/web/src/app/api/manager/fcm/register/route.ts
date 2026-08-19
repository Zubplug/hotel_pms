import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { verifyMobileToken } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Mobile-only endpoint — only accepts Bearer JWT
    const session = await verifyMobileToken(req);
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { token, platform } = body as { token?: string; platform?: string };

    if (!token || typeof token !== 'string' || token.trim() === '') {
      return errorResponse('BAD_REQUEST', 'FCM token is required', 400);
    }
    if (!platform || !['ios', 'android'].includes(platform)) {
      return errorResponse('BAD_REQUEST', 'Platform must be ios or android', 400);
    }

    // Upsert — if the token already exists update its userId (device may have been re-assigned)
    // If the user already has this token, this is a no-op.
    await prisma.deviceToken.upsert({
      where: { token },
      update: {
        userId: session.id,
        platform,
        updatedAt: new Date(),
      },
      create: {
        userId: session.id,
        token,
        platform,
      },
    });

    return successResponse({ registered: true }, 200);

  } catch (err: any) {
    console.error('[FCM Register API POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to register device token', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req);
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { token } = body as { token?: string };

    if (!token) return errorResponse('BAD_REQUEST', 'FCM token is required', 400);

    await prisma.deviceToken.deleteMany({
      where: { token, userId: session.id },
    });

    return successResponse({ unregistered: true }, 200);

  } catch (err: any) {
    console.error('[FCM Unregister API DELETE]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to unregister device token', 500);
  }
}
