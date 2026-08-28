import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';

const REVIEWER_ROLES = ['CEO', 'SUPER_ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'GENERAL_CASHIER'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  try {
    const actor = await auth();
    if (!actor?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const actorUserId = actor.user.id;
    const role = String((actor.user as any).role || '').toUpperCase();
    if (!REVIEWER_ROLES.includes(role) && !(actor.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Shift approval access required', 403);
    }

    const { shiftId } = await params;
    const { decision, notes } = await req.json();
    if (!['APPROVED', 'APPROVED_WITH_VARIANCE', 'REJECTED'].includes(decision)) {
      return errorResponse('BAD_REQUEST', 'Invalid approval decision', 400);
    }

    const staff = await prisma.staff.findFirst({ where: { userId: actorUserId }, select: { id: true } });
    if (!staff) return errorResponse('UNAUTHORIZED', 'Reviewer staff record not found', 401);

    const frontdesk = await prisma.frontdeskSession.findUnique({ where: { id: shiftId }, include: { exceptions: true } });
    if (frontdesk) {
      if (!(await getUserPropertyIds(actorUserId)).includes(frontdesk.propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
      if (!['CLOSED', 'UNDER_REVIEW'].includes(frontdesk.status)) return errorResponse('BAD_REQUEST', `Cannot approve shift in status ${frontdesk.status}`, 400);
      if (frontdesk.staffId === staff.id) return errorResponse('FORBIDDEN', 'A shift cannot be approved by its operator', 403);
      if (frontdesk.exceptions.some(exception => exception.status === 'OPEN') && decision === 'APPROVED') {
        return errorResponse('CONFLICT', 'Resolve open exceptions or approve with variance', 409);
      }
      const nextStatus = decision === 'REJECTED' ? 'UNDER_REVIEW' : 'RECONCILED';
      const updated = await prisma.$transaction(async tx => {
        const result = await tx.frontdeskSession.update({ where: { id: shiftId }, data: { status: nextStatus, reconciledAt: new Date(), reconciledBy: staff.id, reconciliationDecision: decision, reconciliationNotes: notes || null } });
        await tx.frontdeskSessionAudit.create({ data: { frontdeskSessionId: shiftId, action: nextStatus === 'RECONCILED' ? 'RECONCILED' : 'RECONCILIATION_REVIEWED', performedBy: staff.id, notes: notes || `Decision: ${decision}` } });
        return result;
      });
      return successResponse({ type: 'FRONT_DESK', shift: updated });
    }

    const pos = await prisma.posSession.findUnique({ where: { id: shiftId }, include: { settlements: { orderBy: { settledAt: 'desc' }, take: 1 } } });
    if (!pos || !pos.propertyId) return errorResponse('NOT_FOUND', 'Shift not found', 404);
    if (!(await getUserPropertyIds(actorUserId)).includes(pos.propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
    const settlement = pos.settlements[0];
    if (!settlement || settlement.status !== 'PENDING_HANDOVER') return errorResponse('BAD_REQUEST', 'This POS shift is not awaiting approval', 400);
    if (settlement.operatorId === staff.id || pos.openedBy === staff.id) return errorResponse('FORBIDDEN', 'A shift cannot be approved by its operator', 403);
    if (decision === 'REJECTED') return errorResponse('BAD_REQUEST', 'POS shift rejection must be handled through a new settlement review', 400);
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.posSettlement.update({ where: { id: settlement.id }, data: { status: 'CLOSED', authorizerId: staff.id } });
      await tx.posSession.update({ where: { id: shiftId }, data: { status: 'CLOSED', approvedBy: staff.id, approvedAt: new Date() } });
      return result;
    });
    return successResponse({ type: 'POS', shift: updated });
  } catch (error) {
    console.error('[Shift approval POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to approve shift', 500);
  }
}
