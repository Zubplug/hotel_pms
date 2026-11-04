import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { prisma } from '@hotel-pms/db';
import { createAuditLog } from '@/lib/audit';
import * as crypto from 'crypto';
import { requireOrganizationContext } from '@/lib/organization-access';
import { CashExpenseService } from '@/lib/services/cash-expense-service';
import { EmployeeExpenseReimbursementService } from '@/lib/services/employee-expense-reimbursement-service';
import { ProcurementService } from '@/lib/inventory/ProcurementService';

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
    const source = String(body.source || 'APPROVAL_REQUEST').toUpperCase();

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return errorResponse('INVALID_INPUT', 'Action must be APPROVE or REJECT', 400);
    }

    // Mobile-safe adapters for approval-center workflows that historically
    // depended on a browser session. These use the same domain services and
    // tenant scope as the web approval center.
    if (source !== 'APPROVAL_REQUEST') {
      const ctx = await requireOrganizationContext(user.id);
      const propertyIds = [...ctx.propertyIds];
      const note = String(comments || body.comment || body.reason || '').trim();
      if (action === 'REJECT' && note.length < 5) {
        return errorResponse('BAD_REQUEST', 'A rejection reason of at least 5 characters is required', 400);
      }
      if (source === 'EXPENSE') {
        const result = action === 'APPROVE'
          ? await CashExpenseService.approve(ctx, approvalId, user.role, note)
          : await CashExpenseService.reject(ctx, approvalId, user.role, note);
        return successResponse(result, 200);
      }
      if (source === 'EMPLOYEE_REIMBURSEMENT') {
        const claim = await prisma.expenseClaim.findFirst({ where: { id: approvalId, propertyId: { in: propertyIds } }, select: { propertyId: true } });
        if (!claim) return errorResponse('NOT_FOUND', 'Reimbursement request not found', 404);
        const actor = { userId: user.id, role: user.role, propertyId: claim.propertyId };
        const result = action === 'APPROVE'
          ? await EmployeeExpenseReimbursementService.approve(approvalId, actor)
          : await EmployeeExpenseReimbursementService.reject(approvalId, actor, note);
        return successResponse(result, 200);
      }
      if (source === 'EMPLOYEE_BENEFIT') {
        const loan = await prisma.employeeLoan.findFirst({ where: { id: approvalId, propertyId: { in: propertyIds }, status: 'MANAGER_REVIEW' }, select: { id: true, requestedBy: true } });
        const advance = loan ? null : await prisma.salaryAdvance.findFirst({ where: { id: approvalId, propertyId: { in: propertyIds }, status: 'MANAGER_REVIEW' }, select: { id: true, requestedBy: true } });
        if (!loan && !advance) return errorResponse('CONFLICT', 'Benefit request is no longer awaiting management review', 409);
        if ((loan || advance)?.requestedBy === user.id) return errorResponse('FORBIDDEN', 'The requester cannot approve their own benefit', 403);
        const result = await prisma.$transaction(async tx => {
          if (loan) return tx.employeeLoan.update({ where: { id: loan.id }, data: action === 'APPROVE' ? { status: 'ACTIVE', approvedBy: user.id, approvedAt: new Date(), rejectionReason: null } : { status: 'REJECTED', rejectedBy: user.id, rejectedAt: new Date(), rejectionReason: note } });
          return tx.salaryAdvance.update({ where: { id: advance!.id }, data: action === 'APPROVE' ? { status: 'APPROVED', approvedBy: user.id, approvedAt: new Date(), rejectionReason: null } : { status: 'REJECTED', rejectedBy: user.id, rejectedAt: new Date(), rejectionReason: note } });
        });
        return successResponse(result, 200);
      }
      if (source === 'PURCHASE_ORDER') {
        const po = await prisma.purchaseOrder.findFirst({ where: { id: approvalId, propertyId: { in: propertyIds } }, select: { id: true, propertyId: true } });
        if (!po) return errorResponse('NOT_FOUND', 'Purchase order not found', 404);
        const result = action === 'APPROVE'
          ? await ProcurementService.approvePO(po.id, user.id, user.role, user.isSuperAdmin)
          : await ProcurementService.rejectPO(po.id, user.id, note, user.role, user.isSuperAdmin);
        return successResponse(result, 200);
      }
      if (source === 'STOCK_TRANSFER') {
        const transfer = await prisma.stockTransfer.findFirst({ where: { id: approvalId, propertyId: { in: propertyIds }, status: { in: ['PENDING_APPROVAL', 'ISSUED'] } }, select: { id: true } });
        if (!transfer) return errorResponse('CONFLICT', 'Stock transfer is no longer awaiting review', 409);
        const result = await prisma.stockTransfer.update({ where: { id: transfer.id }, data: action === 'APPROVE' ? { status: 'APPROVED', approvedBy: user.id, approvedAt: new Date() } : { status: 'REJECTED', notes: note } });
        return successResponse(result, 200);
      }
      return errorResponse('BAD_REQUEST', `Unsupported mobile approval source: ${source}`, 400);
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
      if (!['GENERAL_CASHIER', 'NIGHT_AUDITOR', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 'CEO', 'EXECUTIVE'].includes(user.role) && !user.isSuperAdmin) {
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
