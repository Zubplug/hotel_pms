import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { prisma } from '@hotel-pms/db';
import { createAuditLog } from '@/lib/audit';
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await resolveUser(req);
    
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Executive access required', 403);
    }

    const approvalId = params.id;
    const body = await req.json();
    const { action, comments } = body; // action: 'APPROVE' | 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return errorResponse('INVALID_INPUT', 'Action must be APPROVE or REJECT', 400);
    }

    const approvalRequest = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
    });

    if (!approvalRequest) {
      return errorResponse('NOT_FOUND', 'Approval request not found', 404);
    }

    if (!user.allowedProperties.includes(approvalRequest.propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    if (approvalRequest.status !== 'PENDING') {
      return errorResponse('CONFLICT', `Request is already ${approvalRequest.status}`, 409);
    }

    // Execute in a transaction for safety
    const updatedRequest = await prisma.$transaction(async (tx) => {
      const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      
      const reqUpdated = await tx.approvalRequest.update({
        where: { id: approvalId },
        data: {
          status: newStatus,
          approverId: user.staffId, // If the user has a linked staff ID
          comments: comments || undefined,
        }
      });

      return reqUpdated;
    });

    // Fire and forget audit log outside of transaction to use standard utility
    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    createAuditLog({
      organizationId: user.organizationId || 'UNKNOWN',
      propertyId: approvalRequest.propertyId,
      userId: user.id,
      userRole: user.role,
      action: `APPROVAL_${action}`,
      resource: 'ApprovalRequest',
      resourceId: approvalId,
      previousValue: { status: 'PENDING' },
      newValue: { status: newStatus, comments },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return successResponse(updatedRequest, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Approvals POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error processing approval', 500);
  }
}
