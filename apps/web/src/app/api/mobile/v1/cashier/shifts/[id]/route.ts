import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { ShiftControlError, ShiftControlService } from '@/lib/services/shift-control-service';

const REVIEWER_ROLES = new Set(['GENERAL_CASHIER', 'FINANCE_MANAGER', 'MANAGER', 'HOTEL_MANAGER', 'CEO', 'SUPER_ADMIN', 'NIGHT_AUDITOR']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const role = String(user.role || '').toUpperCase();
    if (!REVIEWER_ROLES.has(role)) return errorResponse('FORBIDDEN', 'You cannot review cashier shifts', 403);
    const ctx = await requireOrganizationContext(user.id);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const type = body.type === 'POS' ? 'POS' : 'FRONT_DESK';
    const action = String(body.action || '').toUpperCase();
    let shift;
    if (action === 'START_REVIEW') shift = await ShiftControlService.startShiftReview(ctx, type, id);
    else if (action === 'APPROVE') shift = await ShiftControlService.approveShift(ctx, type, id);
    else if (action === 'APPROVE_WITH_VARIANCE') shift = await ShiftControlService.approveShiftWithVariance(ctx, type, id, String(body.reasonCode || ''), String(body.notes || '').trim());
    else if (action === 'RETURN') shift = await ShiftControlService.returnShift(ctx, type, id, String(body.notes || '').trim());
    else return errorResponse('BAD_REQUEST', 'Invalid shift review action', 400);
    return successResponse({ type, shift });
  } catch (error: any) {
    if (error instanceof ShiftControlError) return errorResponse(error.code, error.message, error.status);
    console.error('[Mobile cashier shift action]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to update shift review', 500);
  }
}
