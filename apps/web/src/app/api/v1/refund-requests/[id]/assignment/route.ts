import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) {
      return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const request = await prisma.refundRequest.findUnique({ where: { id } });
    if (!request) return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
    if (!user.allowedProperties.includes(request.propertyId)) {
      return NextResponse.json({ error: 'Property access denied' }, { status: 403 });
    }
    if (request.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'Only pending requests can be reassigned' }, { status: 409 });
    }

    const approverId = body.approverId ? String(body.approverId) : null;
    const approvalRoleId = body.approvalRoleId ? String(body.approvalRoleId) : null;
    const updated = await prisma.$transaction(async tx => {
      if (approverId) {
        const membership = await tx.userRole.findFirst({
          where: { userId: approverId, OR: [{ propertyId: request.propertyId }, { propertyId: null }] }
        });
        if (!membership) throw new Error('APPROVER_NOT_ASSIGNED');
      }
      if (approvalRoleId) {
        const role = await tx.role.findFirst({ where: { id: approvalRoleId, organizationId: request.organizationId } });
        if (!role) throw new Error('ROLE_NOT_FOUND');
      }
      const approval = await tx.approvalRequest.findFirst({ where: { type: 'REFUND', details: { path: ['refundRequestId'], equals: request.id } } });
      const details = { refundRequestId: request.id, category: request.category, requestedAmount: Number(request.requestedAmount), approverId, approverRoleId: approvalRoleId };
      if (approval) await tx.approvalRequest.update({ where: { id: approval.id }, data: { details } });
      return tx.refundRequest.update({ where: { id }, data: { currentApproverId: approverId, approvalRoleId } });
    });
    return NextResponse.json({ data: updated });
  } catch (error: any) {
    if (error.message === 'APPROVER_NOT_ASSIGNED') return NextResponse.json({ error: 'Approver is not assigned to this property' }, { status: 400 });
    if (error.message === 'ROLE_NOT_FOUND') return NextResponse.json({ error: 'Approval role not found' }, { status: 400 });
    console.error('[Refund Assignment PATCH]', error);
    return NextResponse.json({ error: 'Unable to assign refund approval' }, { status: 500 });
  }
}
