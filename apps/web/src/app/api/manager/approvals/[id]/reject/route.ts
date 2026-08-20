import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Manager access required', 403);
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.reason as string | undefined;

    const result = await prisma.$transaction(async (tx) => {
      const approval = await tx.approvalRequest.findUnique({
        where: { id: (await params).id },
      });

      if (!approval) throw new Error('NOT_FOUND');

      if (!user.allowedProperties.includes(approval.propertyId)) {
        throw new Error('FORBIDDEN');
      }

      if (approval.status !== 'PENDING') throw new Error('CONFLICT');

      const updatedApproval = await tx.approvalRequest.update({
        where: { id: (await params).id },
        data: {
          status: 'REJECTED',
          reviewedBy: user.id,
          reviewedAt: new Date(),
          ...(reason ? { reason } : {}),
        },
      });

      // Audit Log
      const property = await tx.property.findUnique({ where: { id: approval.propertyId } });
      await tx.auditLog.create({
        data: {
          organizationId: property?.organizationId || '',
          propertyId: approval.propertyId,
          userId: user.id,
          action: 'REJECT_REQUEST',
          resource: 'ApprovalRequest',
          resourceId: approval.id,
          newValue: { type: approval.type, amount: approval.amount, reason },
          ipAddress: req.headers.get('x-forwarded-for') || '',
          userAgent: req.headers.get('user-agent') || '',
          requestId: crypto.randomUUID()
        },
      });

      return updatedApproval;
    });

    return successResponse(result, 200);

  } catch (err: any) {
    console.error(`[Manager Reject API POST] Error: ${err.message}`);
    if (err.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Approval request not found', 404);
    if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Access denied', 403);
    if (err.message === 'CONFLICT') return errorResponse('CONFLICT', 'Request is no longer pending', 409);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error rejecting approval', 500);
  }
}
