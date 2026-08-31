import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { prisma } from '@hotel-pms/db';
import { createAuditLog } from '@/lib/audit';
import * as crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveUser(req);
    
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const approvalId = (await params).id;
    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const { action, comments } = body; // action: 'APPROVE' | 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return errorResponse('INVALID_INPUT', 'Action must be APPROVE or REJECT', 400);
    }

    const idempotencyKey = req.headers.get('x-idempotency-key');
    const requestHash = crypto.createHash('sha256').update(bodyText).digest('hex');

    // Execute in a transaction for safety
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Resolve Approval
      const approvalRequest = await tx.approvalRequest.findUnique({
        where: { id: approvalId },
        include: { property: true }
      });

      if (!approvalRequest) {
        throw new Error('NOT_FOUND:Approval request not found');
      }

      // 2. Verify Property Access
      const hasSpecificAccess = user.allowedProperties.includes(approvalRequest.propertyId);
      
      if (!hasSpecificAccess) {
        throw new Error('FORBIDDEN:No access to this property');
      }

      // 3. Verify Capability / Limit (Assume simple role check for now as we don't have limit logic yet)
      if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 'EXECUTIVE'].includes(user.role) && !user.isSuperAdmin) {
        throw new Error('FORBIDDEN:Executive access required');
      }

      // 4. Idempotency Check
      if (idempotencyKey) {
        const existingMutation = await tx.approvalMutation.findUnique({
          where: { idempotencyKey }
        });

        if (existingMutation) {
          // If exact same request, return cached result
          if (existingMutation.requestHash === requestHash && existingMutation.userId === user.id) {
            return {
              cached: true,
              payload: existingMutation.responsePayload,
              status: existingMutation.status
            };
          } else {
            throw new Error('CONFLICT:Idempotency conflict');
          }
        }
      }

      // 5. Verify PENDING state
      if (approvalRequest.status !== 'PENDING') {
        throw new Error(`CONFLICT:Request is already ${approvalRequest.status}`);
      }

      // 6. Atomic State Transition
      const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      
      const updateResult = await tx.approvalRequest.updateMany({
        where: { id: approvalId, status: 'PENDING' },
        data: {
          status: newStatus,
          reviewedBy: user.id,
          reviewedAt: new Date(),
        }
      });

      if (updateResult.count === 0) {
        throw new Error('CONFLICT:Request was modified concurrently');
      }

      // Fetch the updated request to return
      const updatedRequest = await tx.approvalRequest.findUnique({
        where: { id: approvalId }
      });

      const responsePayload = { updatedRequest, action, comments };

      // 7. Record Mutation if idempotency key provided
      if (idempotencyKey) {
        await tx.approvalMutation.create({
          data: {
            idempotencyKey,
            userId: user.id,
            approvalId,
            action,
            requestHash,
            status: newStatus,
            responsePayload,
            completedAt: new Date(),
          }
        });
      }

      return { cached: false, payload: responsePayload, status: newStatus };
    });

    if (result.cached) {
      return successResponse(result.payload, 200);
    }

    if (!result.payload || typeof result.payload !== 'object' || !('updatedRequest' in result.payload) || !result.payload.updatedRequest) {
      throw new Error('INTERNAL_ERROR:Invalid payload returned');
    }

    const payloadObj = result.payload as { updatedRequest: any; action: string; comments: string };
    
    // Fetch property to get organizationId
    const property = await prisma.property.findUnique({ where: { id: payloadObj.updatedRequest.propertyId } });

    // 8. Fire and forget audit log outside of transaction to use standard utility
    createAuditLog({
      organizationId: property?.organizationId || 'UNKNOWN',
      propertyId: payloadObj.updatedRequest.propertyId,
      userId: user.id,
      userRole: user.role,
      action: `APPROVAL_${action}`,
      resource: 'ApprovalRequest',
      resourceId: approvalId,
      previousValue: { status: 'PENDING' },
      newValue: { status: result.status, comments },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return successResponse(payloadObj.updatedRequest, 200);

  } catch (err: any) {
    if (err.message && err.message.includes(':')) {
      const [code, msg] = err.message.split(':');
      const statusCode = code === 'NOT_FOUND' ? 404 : (code === 'FORBIDDEN' ? 403 : 409);
      return errorResponse(code, msg, statusCode);
    }
    console.error('[Mobile Executive Approvals POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error processing approval', 500);
  }
}
