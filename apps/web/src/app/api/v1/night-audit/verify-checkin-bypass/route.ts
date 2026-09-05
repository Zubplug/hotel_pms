import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { assertPropertyAccess } from '@/lib/property-access';
import { hasPermission } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Not authenticated', 401);

    const body = await req.json();
    const { bypassId, action, notes, propertyId } = body;

    if (!bypassId || !action || !propertyId) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    if (action !== 'VERIFY' && action !== 'REJECT') {
      return errorResponse('BAD_REQUEST', 'Action must be VERIFY or REJECT', 400);
    }

    // Verify access
    await assertPropertyAccess(session.user.id, propertyId);
    if (!await hasPermission(session.user.id, 'property', 'manage', propertyId)) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const bypass = await prisma.checkInBypass.findUnique({
      where: { id: bypassId }
    });

    if (!bypass) {
      return errorResponse('NOT_FOUND', 'Check-In Bypass record not found', 404);
    }

    if (bypass.propertyId !== propertyId) {
      return errorResponse('FORBIDDEN', 'Property mismatch', 403);
    }

    // Depending on hotel policy, we just record the review and update status
    // A REJECTED bypass will remain a blocker for the night audit until resolved.
    const newStatus = action === 'VERIFY' ? 'VERIFIED' : 'REJECTED';

    await prisma.checkInBypass.update({
      where: { id: bypassId },
      data: {
        status: newStatus,
        reviewedByStaffId: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: notes
      }
    });

    return successResponse({ success: true, status: newStatus });
  } catch (error: any) {
    console.error('Verify checkin bypass error:', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Internal server error', 500);
  }
}
