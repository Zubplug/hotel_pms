import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Manager access required', 403);
    }

    const allowedPropertyIds = user.allowedProperties;
    
    // Begin an atomic transaction to ensure idempotency and safety
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch the request
      const approval = await tx.approvalRequest.findUnique({
        where: { id: params.id },
      });

      if (!approval) {
        throw new Error('NOT_FOUND');
      }

      // 2. Validate Authorization / Property Scope
      if (!allowedPropertyIds.includes(approval.propertyId)) {
        throw new Error('FORBIDDEN');
      }

      // 3. Idempotency Check (Only allow PENDING to APPROVED)
      if (approval.status !== 'PENDING') {
        throw new Error('CONFLICT');
      }

      // 4. State Transition
      const updatedApproval = await tx.approvalRequest.update({
        where: { id: params.id },
        data: {
          status: 'APPROVED',
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      // 5. Audit Log (Immutable record)
      await tx.auditLog.create({
        data: {
          organizationId: (await tx.property.findUnique({ where: { id: approval.propertyId } }))?.organizationId || '',
          propertyId: approval.propertyId,
          userId: user.id,
          action: 'APPROVE_REQUEST',
          entityType: 'ApprovalRequest',
          entityId: approval.id,
          details: { type: approval.type, amount: approval.amount },
          ipAddress: req.ip || '',
          userAgent: req.headers.get('user-agent') || '',
          status: 'SUCCESS',
        }
      });

      // 6. Execute the actual business logic based on type (e.g. Refund, Void)
      // In a real system, you'd integrate with the payment gateway or POS service here.
      if (approval.type === 'REFUND') {
         // Perform refund operation securely
      } else if (approval.type === 'VOID') {
         // Perform void operation
      }

      return updatedApproval;
    });

    // TODO: Broadcast WebSocket Event 'APPROVAL_UPDATED'

    return successResponse(result, 200);

  } catch (err: any) {
    console.error(`[Manager Approve API POST] Error: ${err.message}`);
    
    if (err.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Approval request not found', 404);
    if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Access denied to this property', 403);
    if (err.message === 'CONFLICT') return errorResponse('CONFLICT', 'Approval request is no longer pending', 409);

    return errorResponse('INTERNAL_ERROR', 'Unexpected error processing approval', 500);
  }
}
