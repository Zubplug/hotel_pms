import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { ShiftControlService, ShiftControlError } from '@/lib/services/shift-control-service';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    const role = String((session.user as any).role || '');
    if (!['MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role) && !(session.user as any).isSuperAdmin) return errorResponse('FORBIDDEN', 'Manager reconciliation access required', 403);
    const { id } = await params;
    const { decision, notes } = await req.json();
    if (!['APPROVED', 'APPROVED_WITH_VARIANCE', 'REJECTED'].includes(decision)) return errorResponse('BAD_REQUEST', 'Invalid decision', 400);
    const staff = await prisma.staff.findFirst({ where: { userId: session.user.id } });
    if (!staff) return errorResponse('UNAUTHORIZED', 'Staff not found', 401);
    const current = await prisma.frontdeskSession.findUnique({ where: { id }, include: { exceptions: true } });
    if (!current) return errorResponse('NOT_FOUND', 'Session not found', 404);
    if (await isNightAuditTransactionLocked(current.propertyId, current.businessDate)) return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Cashier reconciliation is temporarily paused while Night Audit is posting.', 409);
    if (!['CLOSED', 'UNDER_REVIEW'].includes(current.status)) return errorResponse('BAD_REQUEST', `Cannot reconcile session in status ${current.status}`, 400);
    const reviewNotes = typeof notes === 'string' ? notes.trim() : '';
    let updated;
    if (decision === 'APPROVED') {
      updated = await ShiftControlService.approveShift('FRONT_DESK', id, staff.id);
    } else if (decision === 'APPROVED_WITH_VARIANCE') {
      updated = await ShiftControlService.approveShiftWithVariance(
        'FRONT_DESK', id, staff.id, role, 'CASH_RECONCILIATION', reviewNotes
      );
    } else {
      updated = await ShiftControlService.returnShift('FRONT_DESK', id, staff.id, reviewNotes);
    }
    return successResponse({ session: updated });
  } catch (error) {
    console.error('[Frontdesk Sessions Reconcile POST]', error);
    if (error instanceof ShiftControlError) return errorResponse(error.code, error.message, error.status);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
