import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { verifyMobileToken } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req);
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!currentPassword || !newPassword) {
      return errorResponse('BAD_REQUEST', 'Current and new passwords are required', 400);
    }
    if (newPassword.length < 12) {
      return errorResponse('BAD_REQUEST', 'New password must contain at least 12 characters', 400);
    }
    if (currentPassword === newPassword) {
      return errorResponse('BAD_REQUEST', 'New password must be different from the current password', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return errorResponse('UNAUTHORIZED', 'Current password is incorrect', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        passwordSetAt: new Date(),
        sessionVersion: { increment: 1 },
      },
    });

    return successResponse({ updated: true, reauthenticationRequired: true });
  } catch (error) {
    console.error('[Mobile password update]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to update password', 500);
  }
}
