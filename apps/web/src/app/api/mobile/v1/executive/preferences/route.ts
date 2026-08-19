import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { prisma } from '@hotel-pms/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const preferences = await prisma.userNotificationPreference.findMany({
      where: { userId: user.id }
    });

    return successResponse(preferences, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Preferences GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching preferences', 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { category, push, inApp, email } = body;

    if (!category) {
      return errorResponse('INVALID_INPUT', 'Category is required', 400);
    }

    const preference = await prisma.userNotificationPreference.upsert({
      where: {
        userId_category: {
          userId: user.id,
          category
        }
      },
      update: {
        push: push !== undefined ? push : undefined,
        inApp: inApp !== undefined ? inApp : undefined,
        email: email !== undefined ? email : undefined,
      },
      create: {
        userId: user.id,
        category,
        push: push ?? true,
        inApp: inApp ?? true,
        email: email ?? false,
      }
    });

    return successResponse(preference, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Preferences PUT]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error updating preferences', 500);
  }
}
