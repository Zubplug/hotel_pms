import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import bcrypt from 'bcryptjs';
import { errorResponse, successResponse } from '@/lib/api-response';
import { verifyMobileToken } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req);
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const pin = String(body.pin || '');
    const currentPassword = String(body.currentPassword || '');

    if (!/^\d{6}$/.test(pin)) {
      return errorResponse('BAD_REQUEST', 'PIN must contain exactly 6 digits', 400);
    }
    if (!currentPassword) {
      return errorResponse('BAD_REQUEST', 'Current password is required to set up a PIN', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return errorResponse('UNAUTHORIZED', 'Current password is incorrect', 401);
    }

    const mobilePinHash = await bcrypt.hash(pin, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mobilePinHash,
        mobilePinSetAt: new Date(),
        mobilePinFailedAttempts: 0,
        mobilePinLockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });

    return successResponse({ configured: true }, 200);
  } catch (error) {
    console.error('[Manager Auth PIN Setup]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to configure mobile PIN', 500);
  }
}
