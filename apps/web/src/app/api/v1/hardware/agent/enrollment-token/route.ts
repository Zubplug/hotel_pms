import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError } from '@/lib/property-access';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

// POST /api/v1/hardware/agent/enrollment-token
// Generates a short-lived, single-use enrollment token for agent registration.
// Requires PROPERTY_ADMIN role.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId } = body;
    if (!propertyId) return errorResponse('VALIDATION_ERROR', 'propertyId is required', 422);

    await assertPropertyAccess(session.user.id, propertyId);
    const canManage = await hasPermission(session.user.id, 'hardware', 'manage', propertyId);
    if (!canManage) return errorResponse('FORBIDDEN', 'Insufficient permissions — requires Property Admin', 403);

    // Generate a cryptographically secure token
    const plainToken = randomBytes(32).toString('hex'); // 64-char hex
    const tokenHash = await bcrypt.hash(plainToken, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.agentEnrollmentToken.create({
      data: {
        propertyId,
        tokenHash,
        expiresAt,
        createdBy: session.user.id,
      },
    });

    return successResponse({ token: plainToken, expiresAt }, 201);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorResponse('FORBIDDEN', err.message, 403);
    console.error('[EnrollmentToken POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
