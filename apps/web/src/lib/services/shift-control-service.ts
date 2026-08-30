import prisma, { Prisma, PosSessionStatus, FrontdeskSessionStatus } from '@hotel-pms/db';
import { ShiftControlStatus, VarianceStatus, assertShiftTransition } from '@/lib/shift-control';
import crypto from 'crypto';

export class ShiftControlError extends Error {
  constructor(message: string, public code: string = 'BAD_REQUEST', public status: number = 400) {
    super(message);
    this.name = 'ShiftControlError';
  }
}

export class ShiftControlService {
  // ─── Internal Audit Writer ────────────────────────────────────────────────
  // Always called inside an existing transaction (tx). Never creates its own.
  private static async audit(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    params: {
      propertyId: string;
      posSessionId?: string;
      frontdeskSessionId?: string;
      action: string;
      fromStatus: string;
      toStatus: string;
      performedBy: string;
      reason?: string | null;
      metadata?: Record<string, unknown>;
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
        reason: params.reason ?? null,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        idempotencyKey: `audit_${crypto.randomUUID()}`
      }
    });
  }

  // ─── Property Settings ────────────────────────────────────────────────────
  private static async getPropertySettings(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    propertyId: string
  ) {
    const prop = await tx.property.findUnique({
      where: { id: propertyId },
      select: {
        cashVarianceGeneralCashierLimit: true,
        cashVarianceFinanceManagerLimit: true,
      }
    });
    if (!prop) throw new ShiftControlError('Property not found', 'NOT_FOUND', 404);
    return {
      generalCashierLimit: Number(prop.cashVarianceGeneralCashierLimit ?? 5000),
      financeManagerLimit: Number(prop.cashVarianceFinanceManagerLimit ?? 50000),
    };
  }

  // ─── Recalculate Expected Cash ────────────────────────────────────────────
  static async recalculateExpectedCash(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    type: 'POS' | 'FRONT_DESK',
    shiftId: string
  ): Promise<number> {
    if (type === 'FRONT_DESK') {
      const shift = await tx.frontdeskSession.findUnique({
        where: { id: shiftId },
        include: { payments: true, cashMovements: true }
      });
      if (!shift) throw new ShiftControlError('Shift not found', 'NOT_FOUND', 404);

      const cashPayments = shift.payments
        .filter((p: any) => p.method === 'CASH' && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(p.status))
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      const movementTotal = (types: string[]) => shift.cashMovements
        .filter((m: any) => types.includes(m.type))
        .reduce((sum: number, m: any) => sum + Number(m.amount), 0);

      return (
        Number(shift.openingFloat ?? 0) +
        cashPayments +
        movementTotal(['CASH_IN', 'CASH_TRANSFER_IN']) -
        movementTotal(['REFUND', 'REFUND_CASH', 'PAID_OUT', 'CASH_DROP', 'CASH_TRANSFER_OUT'])
      );
    } else {
      const shift = await tx.posSession.findUnique({ where: { id: shiftId } });
      if (!shift) throw new ShiftControlError('Shift not found', 'NOT_FOUND', 404);
      return (
        Number(shift.openingCash ?? 0) +
        Number(shift.cashSales ?? 0) +
        Number(shift.cashIn ?? 0) -
        Number(shift.cashRefunds ?? 0) -
        Number(shift.cashOut ?? 0)
      );
    }
  }

  // ─── submitShift ──────────────────────────────────────────────────────────
  /**
   * Transitions a shift from OPEN → SUBMITTED (or RETURNED → SUBMITTED for
   * re-declarations). Called INTERNALLY by the close/settle endpoints inside
   * their own transaction — it is NOT a standalone public API.
   *
   * Status model:
   *   session.status        = CLOSED    (operational session is locked)
   *   session.controlStatus = SUBMITTED (awaiting Finance review)
   */
  static async submitShift(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    type: 'POS' | 'FRONT_DESK',
    shiftId: string,
    operatorId: string,
    params: {
      declaredCash: number;
      expectedCash: number;
      variance: number;
      varianceStatus: string | null;
      propertyId: string;
    }
  ) {
    const fromControlStatus = await (async () => {
      if (type === 'POS') {
        const s = await tx.posSession.findUnique({ where: { id: shiftId }, select: { controlStatus: true } });
        return s?.controlStatus ?? 'OPEN';
      } else {
        const s = await tx.frontdeskSession.findUnique({ where: { id: shiftId }, select: { controlStatus: true } });
        return s?.controlStatus ?? 'OPEN';
      }
    })();

    // Allow re-submission from RETURNED state (operator re-declared cash)
    const allowedFrom = ['OPEN', 'RETURNED'];
    if (!allowedFrom.includes(fromControlStatus)) {
      throw new ShiftControlError(
        `Cannot submit shift from controlStatus '${fromControlStatus}'.`,
        'CONFLICT',
        409
      );
    }

    const updated =
      type === 'POS'
        ? await tx.posSession.update({
            where: { id: shiftId },
            data: {
              status: PosSessionStatus.CLOSED,
              controlStatus: 'SUBMITTED',
              varianceStatus: params.varianceStatus,
              submittedAt: new Date(),
              submittedBy: operatorId,
              closedAt: new Date(),
              actualCash: params.declaredCash,
              expectedCash: params.expectedCash,
              variance: params.variance,
              // Clear any prior approval fields from a previous submission cycle
              approvedBy: null,
              approvedAt: null,
            }
          })
        : await tx.frontdeskSession.update({
            where: { id: shiftId },
            data: {
              status: FrontdeskSessionStatus.CLOSED,
              controlStatus: 'SUBMITTED',
              varianceStatus: params.varianceStatus,
              submittedAt: new Date(),
              submittedBy: operatorId,
              closedAt: new Date(),
              declaredCash: params.declaredCash,
              systemExpectedCash: params.expectedCash,
              variance: params.variance,
              approvedBy: null,
              approvedAt: null,
            }
          });

    await this.audit(tx, {
      propertyId: params.propertyId,
      posSessionId: type === 'POS' ? shiftId : undefined,
      frontdeskSessionId: type === 'FRONT_DESK' ? shiftId : undefined,
      action: fromControlStatus === 'RETURNED' ? 'SHIFT_RESUBMITTED' : 'SHIFT_SUBMITTED',
      fromStatus: fromControlStatus,
      toStatus: 'SUBMITTED',
      performedBy: operatorId,
      metadata: {
        expectedCash: params.expectedCash,
        declaredCash: params.declaredCash,
        variance: params.variance,
      }
    });

    return updated;
  }

  // ─── startShiftReview ─────────────────────────────────────────────────────
  /**
   * Reviewer explicitly starts reviewing a SUBMITTED shift.
   * Transition: controlStatus SUBMITTED → UNDER_REVIEW.
   * This IS a standalone public operation exposed via API endpoint.
   */
  static async startShiftReview(
    type: 'POS' | 'FRONT_DESK',
    shiftId: string,
    reviewerId: string
  ) {
    return prisma.$transaction(async tx => {
      const shift = await this.validateAndGetShift(tx, type, shiftId, reviewerId);
      assertShiftTransition(shift.controlStatus, 'UNDER_REVIEW');

      const updated =
        type === 'POS'
          ? await tx.posSession.update({ where: { id: shiftId }, data: { controlStatus: 'UNDER_REVIEW' } })
          : await tx.frontdeskSession.update({ where: { id: shiftId }, data: { controlStatus: 'UNDER_REVIEW' } });

      await this.audit(tx, {
        propertyId: shift.propertyId,
        posSessionId: type === 'POS' ? shiftId : undefined,
        frontdeskSessionId: type === 'FRONT_DESK' ? shiftId : undefined,
        action: 'SHIFT_REVIEW_STARTED',
        fromStatus: shift.controlStatus,
        toStatus: 'UNDER_REVIEW',
        performedBy: reviewerId,
      });

      return updated;
    });
  }

  // ─── approveShift ─────────────────────────────────────────────────────────
  static async approveShift(type: 'POS' | 'FRONT_DESK', shiftId: string, reviewerId: string) {
    return prisma.$transaction(async tx => {
      const shift = await this.validateAndGetShift(tx, type, shiftId, reviewerId);
      assertShiftTransition(shift.controlStatus, 'APPROVED');

      const expected = await this.recalculateExpectedCash(tx, type, shiftId);
      const declared = type === 'POS' ? Number(shift.actualCash ?? 0) : Number(shift.declaredCash ?? 0);
      const variance = declared - expected;

      if (Math.abs(variance) > 0.01) {
        throw new ShiftControlError(
          'A shift with a variance cannot be approved without acknowledgement. Use approve-with-variance.',
          'CONFLICT',
          409
        );
      }

      const updateData = {
        controlStatus: 'APPROVED' as const,
        approvalDecision: 'APPROVED',
        approvedBy: reviewerId,
        approvedAt: new Date(),
        variance: 0,
        status: type === 'POS'
          ? PosSessionStatus.CLOSED
          : FrontdeskSessionStatus.CLOSED,
        ...(type === 'POS'
          ? { actualCash: expected, expectedCash: expected }
          : { systemExpectedCash: expected }
        )
      } as any;

      let updated;
      if (type === 'POS') {
        updated = await tx.posSession.update({ where: { id: shiftId }, data: updateData });
        const settlement = await tx.posSettlement.findFirst({ where: { sessionId: shiftId }, orderBy: { settledAt: 'desc' } });
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
        metadata: { expected, declared, variance },
      });

      return updated;
    });
  }

  // ─── approveShiftWithVariance ─────────────────────────────────────────────
  static async approveShiftWithVariance(
    type: 'POS' | 'FRONT_DESK',
    shiftId: string,
    reviewerId: string,
    role: string,
    reasonCode: string,
    notes: string
  ) {
    return prisma.$transaction(async tx => {
      const shift = await this.validateAndGetShift(tx, type, shiftId, reviewerId);
      assertShiftTransition(shift.controlStatus, 'APPROVED_WITH_VARIANCE');
      if (!reasonCode) throw new ShiftControlError('Reason code is required', 'BAD_REQUEST');
      if (!notes) throw new ShiftControlError('Reviewer notes are required', 'BAD_REQUEST');

      const expected = await this.recalculateExpectedCash(tx, type, shiftId);
      const declared = type === 'POS' ? Number(shift.actualCash ?? 0) : Number(shift.declaredCash ?? 0);
      const variance = declared - expected;
      const absVariance = Math.abs(variance);

      if (absVariance <= 0.01) {
        throw new ShiftControlError('Approve with variance requires a non-zero variance', 'BAD_REQUEST');
      }

      const limits = await this.getPropertySettings(tx, shift.propertyId);
      const userRole = role.toUpperCase();

      if (absVariance > limits.financeManagerLimit && !['CEO', 'SUPER_ADMIN', 'MANAGER'].includes(userRole)) {
        throw new ShiftControlError('Variance exceeds your authority limit. Escalation required.', 'FORBIDDEN', 403);
      }
      if (absVariance > limits.generalCashierLimit && !['CEO', 'SUPER_ADMIN', 'MANAGER', 'FINANCE_MANAGER'].includes(userRole)) {
        throw new ShiftControlError('Variance exceeds General Cashier limit. Finance Manager approval required.', 'FORBIDDEN', 403);
      }

      const updateData = {
        controlStatus: 'APPROVED_WITH_VARIANCE' as const,
        varianceStatus: 'ACCEPTED',
        approvalDecision: 'APPROVED_WITH_VARIANCE',
        approvalNotes: notes,
        reasonCode,
        reasonNotes: notes,
        approvedBy: reviewerId,
        approvedAt: new Date(),
        variance,
        status: type === 'POS'
          ? PosSessionStatus.CLOSED
          : FrontdeskSessionStatus.CLOSED,
        ...(type === 'POS' ? { expectedCash: expected } : { systemExpectedCash: expected }),
      } as any;

      let updated;
      if (type === 'POS') {
        updated = await tx.posSession.update({ where: { id: shiftId }, data: updateData });
        const settlement = await tx.posSettlement.findFirst({ where: { sessionId: shiftId }, orderBy: { settledAt: 'desc' } });
        if (settlement) await tx.posSettlement.update({ where: { id: settlement.id }, data: { status: 'CLOSED', authorizerId: reviewerId, variance } });
      } else {
        updated = await tx.frontdeskSession.update({ where: { id: shiftId }, data: updateData });
        await tx.reconciliationException.updateMany({
          where: { frontdeskSessionId: shiftId, status: 'OPEN' },
          data: { status: 'ACCEPTED', acceptedBy: reviewerId, acceptedAt: new Date(), resolutionNotes: notes }
        });
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
        metadata: { expected, declared, variance, notes },
      });

      return updated;
    });
  }

  // ─── returnShift ──────────────────────────────────────────────────────────
  /**
   * Finance returns a shift for correction.
   *
   * Two-dimension model:
   *   status        = CLOSED    — the operational session stays locked (no new transactions)
   *   controlStatus = RETURNED  — Finance rejected the declaration; operator must re-declare
   *
   * The operator re-declares by calling the close/settle endpoint again, which
   * calls ShiftControlService.submitShift() and advances controlStatus → SUBMITTED.
   */
  static async returnShift(
    type: 'POS' | 'FRONT_DESK',
    shiftId: string,
    reviewerId: string,
    notes: string
  ) {
    return prisma.$transaction(async tx => {
      const shift = await this.validateAndGetShift(tx, type, shiftId, reviewerId);
      assertShiftTransition(shift.controlStatus, 'RETURNED');
      if (!notes) throw new ShiftControlError('Notes are required to return a shift', 'BAD_REQUEST');

      // status stays CLOSED — the session is operationally done.
      // controlStatus = RETURNED signals Finance rejected the cash declaration.
      const updateData = {
        controlStatus: 'RETURNED' as const,
        approvalDecision: 'REJECTED',
        approvalNotes: notes,
      };

      let updated;
      if (type === 'POS') {
        updated = await tx.posSession.update({ where: { id: shiftId }, data: updateData });
        const settlement = await tx.posSettlement.findFirst({ where: { sessionId: shiftId }, orderBy: { settledAt: 'desc' } });
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
        metadata: { notes },
      });

      return updated;
    });
  }

  // ─── validateAndGetShift ──────────────────────────────────────────────────
  private static async validateAndGetShift(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    type: 'POS' | 'FRONT_DESK',
    shiftId: string,
    reviewerId: string
  ) {
    let shift: any;
    if (type === 'POS') {
      shift = await tx.posSession.findUnique({ where: { id: shiftId } });
      if (!shift) throw new ShiftControlError('Shift not found', 'NOT_FOUND', 404);
      if (shift.openedBy === reviewerId || shift.primaryOperatorId === reviewerId) {
        throw new ShiftControlError('A shift cannot be reviewed by its own operator', 'FORBIDDEN', 403);
      }
    } else {
      shift = await tx.frontdeskSession.findUnique({ where: { id: shiftId } });
      if (!shift) throw new ShiftControlError('Shift not found', 'NOT_FOUND', 404);
      if (shift.staffId === reviewerId) {
        throw new ShiftControlError('A shift cannot be reviewed by its own operator', 'FORBIDDEN', 403);
      }
    }
    return shift;
  }
}
