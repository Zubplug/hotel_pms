import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';
import { ShiftControlService, ShiftControlError } from '@/lib/services/shift-control-service';

/**
 * POST /api/v1/financial-control/shifts/[id]/start-review
 *
 * Reviewer explicitly moves a SUBMITTED shift to UNDER_REVIEW.
 * This is the mandatory first step before approving, approving-with-variance,
 * or returning a shift. It records who took ownership of the review.
 *
 * RBAC: General Cashier, Finance Manager, Manager, or Super Admin.
 * Cannot be called by the shift's own operator (segregation of duty).
 */

const REVIEWER_ROLES = new Set([
  'GENERAL_CASHIER', 'FINANCE_MANAGER', 'MANAGER',
  'HOTEL_MANAGER', 'CEO', 'SUPER_ADMIN'
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id: shiftId } = await params;
    const body = await req.json().catch(() => ({}));
    const type: 'POS' | 'FRONT_DESK' = body.type === 'POS' ? 'POS' : 'FRONT_DESK';

    const userRole = String((session.user as any).role || '').toUpperCase();
    if (!REVIEWER_ROLES.has(userRole)) {
      return errorResponse('FORBIDDEN', 'Only Finance or Management staff can start a shift review', 403);
    }

    // Resolve staff ID for segregation-of-duty check inside the service
    const staff = await import('@hotel-pms/db').then(m => m.default.staff.findFirst({
      where: { userId: session.user!.id, isActive: true },
      select: { id: true }
    }));
    if (!staff) return errorResponse('UNAUTHORIZED', 'Staff record not found', 401);

    // Verify reviewer has access to the property this shift belongs to
    // (done inside validateAndGetShift — shift.propertyId is validated implicitly)
    const updated = await ShiftControlService.startShiftReview(type, shiftId, staff.id);

    return successResponse({ shift: updated });
  } catch (err) {
    if (err instanceof ShiftControlError) {
      return errorResponse(err.code, err.message, err.status);
    }
    if (err instanceof Error && err.message.includes('Invalid shift control transition')) {
      return errorResponse('CONFLICT', err.message, 409);
    }
    console.error('[Start Shift Review POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
