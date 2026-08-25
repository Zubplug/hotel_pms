import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

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
    if (!['CLOSED', 'UNDER_REVIEW'].includes(current.status)) return errorResponse('BAD_REQUEST', `Cannot reconcile session in status ${current.status}`, 400);
    const openExceptions = current.exceptions.filter(exception => exception.status === 'OPEN');
    if (openExceptions.length && decision === 'APPROVED') return errorResponse('CONFLICT', 'Resolve open exceptions or approve with variance', 409);
    const nextStatus = decision === 'REJECTED' ? 'UNDER_REVIEW' : 'RECONCILED';
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.frontdeskSession.update({ where: { id }, data: { status: nextStatus, reconciledAt: new Date(), reconciledBy: staff.id, reconciliationDecision: decision, reconciliationNotes: notes } });
      await tx.frontdeskSessionAudit.create({ data: { frontdeskSessionId: id, action: nextStatus === 'RECONCILED' ? 'RECONCILED' : 'RECONCILIATION_REVIEWED', performedBy: staff.id, notes: notes || `Decision: ${decision}` } });
      return result;
    });
    return successResponse({ session: updated });
  } catch (error) {
    console.error('[Frontdesk Sessions Reconcile POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
