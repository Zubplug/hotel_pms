import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['FRONT_DESK_MANAGER', 'MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Approval access required', 403);
    }
    const { id } = await params;
    const body = await req.json();
    const comment = String(body.comment || body.reason || '').trim();
    if (!comment) return errorResponse('BAD_REQUEST', 'A rejection comment is required', 400);

    const result = await prisma.$transaction(async tx => {
      const approval = await tx.approvalRequest.findUnique({ where: { id } });
      if (!approval || approval.status !== 'PENDING') throw new Error('CONFLICT');
      if (!user.allowedProperties.includes(approval.propertyId) && !user.isSuperAdmin) throw new Error('FORBIDDEN');
      const details = (approval.details || {}) as { refundRequestId?: string; approverId?: string; approverRoleId?: string };
      if (details.approverId && details.approverId !== user.id) throw new Error('ASSIGNED_APPROVER_REQUIRED');
      if (details.approverRoleId && !await tx.userRole.findFirst({ where: { userId: user.id, roleId: details.approverRoleId, OR: [{ propertyId: approval.propertyId }, { propertyId: null }] } })) throw new Error('ASSIGNED_ROLE_REQUIRED');
      if (details.refundRequestId) {
        await tx.refundRequest.update({ where: { id: details.refundRequestId, status: 'PENDING_APPROVAL' }, data: { status: 'REJECTED' } });
        await tx.refundApproval.create({ data: { refundRequestId: details.refundRequestId, approverId: user.id, decision: 'REJECTED', comments: comment } });
      }
      const property = await tx.property.findUnique({ where: { id: approval.propertyId } });
      await tx.auditLog.create({
        data: {
          organizationId: property?.organizationId || '',
          propertyId: approval.propertyId,
          userId: user.id,
          action: 'REJECT_REQUEST',
          resource: 'ApprovalRequest',
          resourceId: approval.id,
          newValue: { type: approval.type, amount: approval.amount, comment },
          ipAddress: req.headers.get('x-forwarded-for') || '',
          userAgent: req.headers.get('user-agent') || '',
          requestId: crypto.randomUUID()
        }
      });
      const updated = await tx.approvalRequest.update({ where: { id }, data: { status: 'REJECTED', reviewedBy: user.id, reviewedAt: new Date(), details: { ...details, rejectionComment: comment } } });
      return updated;
    });
    return successResponse(result, 200);
  } catch (error: any) {
    if (error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Access denied', 403);
    if (error.message === 'ASSIGNED_APPROVER_REQUIRED') return errorResponse('FORBIDDEN', 'This request is assigned to another approver.', 403);
    if (error.message === 'ASSIGNED_ROLE_REQUIRED') return errorResponse('FORBIDDEN', 'You do not hold the approval role assigned to this refund.', 403);
    if (error.message === 'CONFLICT') return errorResponse('CONFLICT', 'Approval is no longer pending.', 409);
    console.error('[Manager Reject API]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to reject approval', 500);
  }
}
