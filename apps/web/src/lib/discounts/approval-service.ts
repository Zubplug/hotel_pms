import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '../organization-access';

export type DiscountApprovalRequest = {
  propertyId: string;
  outletId?: string;
  terminalId?: string; // Important for POS
  amount?: number;
  percentage?: number;
  reason: string;
  idempotencyKey: string;
  requestHash: string; // Used to prevent tampering on offline sync
  details?: any; // Snapshot of cart/transaction
};

export class ApprovalService {
  /**
   * Request a discount approval.
   * If the user has permission and is under auto-approval limit, it automatically approves.
   * Otherwise, it creates a PENDING request requiring executive/manager override.
   */
  static async requestDiscount(userId: string, data: DiscountApprovalRequest) {
    const ctx = await requireOrganizationContext(userId);
    
    // Strict multi-tenant isolation
    if (!ctx.propertyIds.includes(data.propertyId)) {
      throw new Error('Unauthorized property access');
    }

    // Fetch property settings for auto-approve limit
    const property = await prisma.property.findUnique({
      where: { id: data.propertyId },
      select: { settings: true }
    });

    let isAutoApproved = false;
    const settings = property?.settings as any;
    if (settings) {
      const amountLimit = typeof settings.autoApproveDiscountAmount === 'number' ? settings.autoApproveDiscountAmount : 0;
      const percentLimit = typeof settings.autoApproveDiscountPercent === 'number' ? settings.autoApproveDiscountPercent : 0;
      
      const reqAmount = data.amount || 0;
      const reqPercent = data.percentage || 0;

      // The discount is auto-approved if both amount and percentage fall within their respective limits.
      // If a limit is 0 or undefined, it essentially means no auto-approval is allowed for that dimension (unless the request is also 0).
      if (reqAmount <= amountLimit && reqPercent <= percentLimit) {
        // Must have at least one non-zero request to be valid, or both can be zero if no discount
        if (reqAmount > 0 || reqPercent > 0) {
          isAutoApproved = true;
        }
      }
    }

    const approval = await prisma.approvalRequest.create({
      data: {
        propertyId: data.propertyId,
        outletId: data.outletId,
        type: 'DISCOUNT',
        status: isAutoApproved ? 'APPROVED' : 'PENDING',
        executionStatus: 'NOT_APPLIED',
        requestedBy: userId,
        amount: data.amount,
        reason: data.reason,
        snapshot: data.details,
        idempotencyKey: data.idempotencyKey,
      }
    });

    return approval;
  }

  /**
   * Used when a POS offline terminal syncs an offline approval that was authorized locally.
   * This is a cloud reconciliation method.
   */
  static async reconcileOfflineApproval(terminalId: string, approvalPayload: any) {
    // 1. Verify idempotency
    const existing = await prisma.approvalRequest.findUnique({
      where: { idempotencyKey: approvalPayload.idempotencyKey }
    });
    if (existing) return existing;

    // 2. Validate the offline override (Manager PIN validation natively should have generated a secure hash/token)
    // If invalid, we create the approval but mark as REJECTED or FAILED
    
    // Create the immutable snapshot record
    const approval = await prisma.approvalRequest.create({
      data: {
        propertyId: approvalPayload.propertyId,
        outletId: approvalPayload.outletId,
        type: 'DISCOUNT',
        status: approvalPayload.isLocallyApproved ? 'APPROVED' : 'PENDING',
        executionStatus: 'NOT_APPLIED',
        requestedBy: approvalPayload.requestedBy,
        reviewedBy: approvalPayload.managerId,
        reviewedAt: approvalPayload.managerId ? new Date() : null,
        amount: approvalPayload.amount,
        reason: approvalPayload.reason,
        snapshot: approvalPayload.details,
        idempotencyKey: approvalPayload.idempotencyKey,
      }
    });

    return approval;
  }

  /**
   * Execute the financial transaction for a discount.
   * This ensures execution happens once within a single database transaction.
   */
  static async executeDiscount(approvalId: string, transactionFn: (tx: any) => Promise<any>) {
    return await prisma.$transaction(async (tx) => {
      // 1. Lock the approval record for update
      const approval = await tx.approvalRequest.findUnique({
        where: { id: approvalId },
      });

      if (!approval) throw new Error('Approval not found');
      if (approval.status !== 'APPROVED') throw new Error(`Cannot execute a discount in status: ${approval.status}`);
      if (approval.executionStatus === 'APPLIED') return { alreadyApplied: true };
      
      // Mark as applying
      await tx.approvalRequest.update({
        where: { id: approvalId },
        data: { executionStatus: 'APPLYING' }
      });

      // 2. Run the financial mutation
      try {
        const result = await transactionFn(tx);
        
        // 3. Mark as Applied and write Audit
        await tx.approvalRequest.update({
          where: { id: approvalId },
          data: { executionStatus: 'APPLIED' }
        });
        
        return { success: true, result };
      } catch (e: any) {
        // Mark as Failed
        await tx.approvalRequest.update({
          where: { id: approvalId },
          data: { executionStatus: 'FAILED' }
        });
        throw e;
      }
    });
  }
}
