import prisma from '@hotel-pms/db';
import { ShiftControlStatus, VarianceStatus, assertShiftTransition } from '@/lib/shift-control';
import crypto from 'crypto';

export class ShiftControlError extends Error {
  constructor(message: string, public code: string = 'BAD_REQUEST', public status: number = 400) {
    super(message);
    this.name = 'ShiftControlError';
  }
}

export class ShiftControlService {
  private static async audit(
    tx: any,
    params: {
      propertyId: string;
      posSessionId?: string;
      frontdeskSessionId?: string;
      action: string;
      fromStatus: string;
      toStatus: string;
      performedBy: string;
      reason?: string | null;
      metadata?: any;
    }
  ) {
    await tx.shiftControlAudit.create({
      data: {
        id: crypto.randomUUID(),
        propertyId: params.propertyId,
        posSessionId: params.posSessionId,
        frontdeskSessionId: params.frontdeskSessionId,
        action: params.action,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        performedBy: params.performedBy,
        reason: params.reason,
        metadata: params.metadata,
        idempotencyKey: `audit_${crypto.randomUUID()}`
      }
    });
  }

  private static async getPropertySettings(tx: any, propertyId: string) {
    const prop = await tx.property.findUnique({
      where: { id: propertyId },
      select: {
        cashVarianceGeneralCashierLimit: true,
        cashVarianceFinanceManagerLimit: true,
      }
    });
    if (!prop) throw new ShiftControlError('Property not found', 'NOT_FOUND', 404);
    
    return {
      generalCashierLimit: Number(prop.cashVarianceGeneralCashierLimit || 5000), // Default fallback
      financeManagerLimit: Number(prop.cashVarianceFinanceManagerLimit || 50000),
    };
  }

  static async recalculateExpectedCash(tx: any, type: 'POS' | 'FRONT_DESK', shiftId: string): Promise<number> {
    if (type === 'FRONT_DESK') {
      const shift = await tx.frontdeskSession.findUnique({ where: { id: shiftId } });
      if (!shift) throw new ShiftControlError('Shift not found', 'NOT_FOUND', 404);
      
      const cashPayments = await tx.payment.aggregate({
        where: {
          receivedBy: shift.staffId,
          propertyId: shift.propertyId,
          method: 'CASH',
          status: 'COMPLETED',
          createdAt: { gte: shift.openedAt, lte: shift.closedAt || new Date() }
        },
        _sum: { amount: true }
      });

      const cashRefunds = await tx.refund.aggregate({
        where: {
          authorizedBy: shift.staffId,
          payment: { method: 'CASH' },
          status: 'COMPLETED',
          createdAt: { gte: shift.openedAt, lte: shift.closedAt || new Date() }
        },
        _sum: { amount: true }
      });

      return Number(shift.openingFloat || 0) + Number(cashPayments._sum.amount || 0) - Number(cashRefunds._sum.amount || 0);
    } else {
      const shift = await tx.posSession.findUnique({ where: { id: shiftId } });
      if (!shift) throw new ShiftControlError('Shift not found', 'NOT_FOUND', 404);
      return Number(shift.openingFloat || 0) + Number(shift.cashSales || 0) + Number(shift.cashIn || 0) - Number(shift.cashRefunds || 0) - Number(shift.cashOut || 0);
    }
  }

  static async submitShift(type: 'POS' | 'FRONT_DESK', shiftId: string, staffId: string) {
    return prisma.$transaction(async tx => {
      // Logic to move shift from OPEN/RETURNED to SUBMITTED
      // Handled primarily by existing close endpoints right now, 
      // but provided here for enterprise workflow consistency.
    });
  }

  static async startShiftReview(type: 'POS' | 'FRONT_DESK', shiftId: string, reviewerId: string) {
    return prisma.$transaction(async tx => {
      // Find shift, ensure it's SUBMITTED, advance to UNDER_REVIEW
      // This is a new explicit step in the workflow.
    });
  }

  static async approveShift(type: 'POS' | 'FRONT_DESK', shiftId: string, reviewerId: string) {
    return prisma.$transaction(async tx => {
      const shift = await this.validateAndGetShift(tx, type, shiftId, reviewerId);
      
      assertShiftTransition(shift.controlStatus, 'APPROVED');
      
      const expected = await this.recalculateExpectedCash(tx, type, shiftId);
      const declared = type === 'POS' ? Number(shift.actualCash || 0) : Number(shift.declaredCash || 0);
      const variance = declared - expected;
      
      if (Math.abs(variance) > 0.01) {
        throw new ShiftControlError('A shift with a variance cannot be approved normally. Use approve-with-variance.', 'CONFLICT', 409);
      }

      const updateData: any = {
        controlStatus: 'APPROVED',
        approvalDecision: 'APPROVED',
        approvedBy: reviewerId,
        approvedAt: new Date(),
        variance: 0,
        ...(type === 'POS' ? { actualCash: expected, expectedCash: expected, status: 'CLOSED' } : { systemExpectedCash: expected, status: 'CLOSED' })
      };

      let updated;
      if (type === 'POS') {
        updated = await tx.posSession.update({ where: { id: shiftId }, data: updateData });
        const settlement = await tx.posSettlement.findFirst({ where: { sessionId: shiftId }, orderBy: { settledAt: 'desc' }});
        if (settlement) await tx.posSettlement.update({ where: { id: settlement.id }, data: { status: 'CLOSED', authorizerId: reviewerId } });
      } else {
        updated = await tx.frontdeskSession.update({ where: { id: shiftId }, data: updateData });
      }

      await this.audit(tx, {
        propertyId: shift.propertyId,
        posSessionId: type === 'POS' ? shiftId : undefined,
        frontdeskSessionId: type === 'FRONT_DESK' ? shiftId : undefined,
        action: 'SHIFT_APPROVED',
        fromStatus: shift.controlStatus,
        toStatus: 'APPROVED',
        performedBy: reviewerId,
        metadata: { expected, declared, variance }
      });

      return updated;
    });
  }

  static async approveShiftWithVariance(type: 'POS' | 'FRONT_DESK', shiftId: string, reviewerId: string, role: string, reasonCode: string, notes: string) {
    return prisma.$transaction(async tx => {
      const shift = await this.validateAndGetShift(tx, type, shiftId, reviewerId);
      
      assertShiftTransition(shift.controlStatus, 'APPROVED_WITH_VARIANCE');
      if (!reasonCode) throw new ShiftControlError('Reason code is required', 'BAD_REQUEST');
      if (!notes) throw new ShiftControlError('Reviewer notes are required', 'BAD_REQUEST');

      const expected = await this.recalculateExpectedCash(tx, type, shiftId);
      const declared = type === 'POS' ? Number(shift.actualCash || 0) : Number(shift.declaredCash || 0);
      const variance = declared - expected;
      const absVariance = Math.abs(variance);

      if (absVariance <= 0.01) {
        throw new ShiftControlError('Approve with variance requires a non-zero variance', 'BAD_REQUEST');
      }

      // Role check based on property settings
      const limits = await this.getPropertySettings(tx, shift.propertyId);
      const userRole = role.toUpperCase();
      
      if (absVariance > limits.financeManagerLimit && !['CEO', 'SUPER_ADMIN', 'MANAGER'].includes(userRole)) {
         throw new ShiftControlError('Variance exceeds your authority limit. Escalation required.', 'FORBIDDEN', 403);
      }
      if (absVariance > limits.generalCashierLimit && !['CEO', 'SUPER_ADMIN', 'MANAGER', 'FINANCE_MANAGER'].includes(userRole)) {
         throw new ShiftControlError('Variance exceeds General Cashier limit. Finance Manager approval required.', 'FORBIDDEN', 403);
      }

      const updateData: any = {
        controlStatus: 'APPROVED_WITH_VARIANCE',
        varianceStatus: 'ACCEPTED',
        approvalDecision: 'APPROVED_WITH_VARIANCE',
        approvalNotes: notes,
        reasonCode,
        reasonNotes: notes,
        approvedBy: reviewerId,
        approvedAt: new Date(),
        variance: variance,
        ...(type === 'POS' ? { expectedCash: expected, status: 'CLOSED' } : { systemExpectedCash: expected, status: 'CLOSED' })
      };

      let updated;
      if (type === 'POS') {
        updated = await tx.posSession.update({ where: { id: shiftId }, data: updateData });
        const settlement = await tx.posSettlement.findFirst({ where: { sessionId: shiftId }, orderBy: { settledAt: 'desc' }});
        if (settlement) await tx.posSettlement.update({ where: { id: settlement.id }, data: { status: 'CLOSED', authorizerId: reviewerId, variance } });
      } else {
        updated = await tx.frontdeskSession.update({ where: { id: shiftId }, data: updateData });
        await tx.reconciliationException.updateMany({ where: { frontdeskSessionId: shiftId, status: 'OPEN' }, data: { status: 'ACCEPTED', acceptedBy: reviewerId, acceptedAt: new Date(), resolutionNotes: notes } });
      }

      await this.audit(tx, {
        propertyId: shift.propertyId,
        posSessionId: type === 'POS' ? shiftId : undefined,
        frontdeskSessionId: type === 'FRONT_DESK' ? shiftId : undefined,
        action: 'VARIANCE_ACCEPTED',
        fromStatus: shift.controlStatus,
        toStatus: 'APPROVED_WITH_VARIANCE',
        performedBy: reviewerId,
        reason: reasonCode,
        metadata: { expected, declared, variance, notes }
      });

      return updated;
    });
  }

  static async returnShift(type: 'POS' | 'FRONT_DESK', shiftId: string, reviewerId: string, notes: string) {
    return prisma.$transaction(async tx => {
      const shift = await this.validateAndGetShift(tx, type, shiftId, reviewerId);
      
      assertShiftTransition(shift.controlStatus, 'RETURNED');
      if (!notes) throw new ShiftControlError('Notes are required to return a shift', 'BAD_REQUEST');

      const updateData: any = {
        controlStatus: 'RETURNED',
        approvalDecision: 'REJECTED',
        approvalNotes: notes,
        ...(type === 'POS' ? { status: 'CLOSED' } : { status: 'CLOSED' }) 
        // POS SETTLED allows operator to re-settle (re-close)
        // FD UNDER_REVIEW might be fine, or we use a more specific POS-friendly return state.
      };

      let updated;
      if (type === 'POS') {
        updated = await tx.posSession.update({ where: { id: shiftId }, data: updateData });
        const settlement = await tx.posSettlement.findFirst({ where: { sessionId: shiftId }, orderBy: { settledAt: 'desc' }});
        if (settlement) await tx.posSettlement.update({ where: { id: settlement.id }, data: { status: 'REJECTED', authorizerId: reviewerId } });
      } else {
        updated = await tx.frontdeskSession.update({ where: { id: shiftId }, data: updateData });
      }

      await this.audit(tx, {
        propertyId: shift.propertyId,
        posSessionId: type === 'POS' ? shiftId : undefined,
        frontdeskSessionId: type === 'FRONT_DESK' ? shiftId : undefined,
        action: 'SHIFT_RETURNED',
        fromStatus: shift.controlStatus,
        toStatus: 'RETURNED',
        performedBy: reviewerId,
        metadata: { notes }
      });

      return updated;
    });
  }

  private static async validateAndGetShift(tx: any, type: 'POS' | 'FRONT_DESK', shiftId: string, reviewerId: string) {
    let shift;
    if (type === 'POS') {
      shift = await tx.posSession.findUnique({ where: { id: shiftId } });
      if (!shift) throw new ShiftControlError('Shift not found', 'NOT_FOUND', 404);
      if (shift.openedBy === reviewerId) throw new ShiftControlError('A shift cannot be approved by its operator', 'FORBIDDEN', 403);
    } else {
      shift = await tx.frontdeskSession.findUnique({ where: { id: shiftId } });
      if (!shift) throw new ShiftControlError('Shift not found', 'NOT_FOUND', 404);
      if (shift.staffId === reviewerId) throw new ShiftControlError('A shift cannot be approved by its operator', 'FORBIDDEN', 403);
    }
    return shift;
  }
}
