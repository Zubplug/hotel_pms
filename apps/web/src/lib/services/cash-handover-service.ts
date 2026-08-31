import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { ShiftControlError } from './shift-control-service';
import { ensureCashierControlAccountsForClient } from './cash-account-service';
import { TenantContext } from '../organization-access';

export class CashHandoverService {
  /**
   * General Cashier initiates a handover to take custody of an operator's approved shift,
   * or an operator initiates it to transfer to a safe.
   */
  static async createHandover(ctx: TenantContext, params: {
    propertyId: string;
    posSessionIds: string[];
    frontdeskSessionIds: string[];
    safeReference?: string;
    notes?: string;
    idempotencyKey?: string;
  }) {
    return prisma.$transaction(async tx => {
      if (params.idempotencyKey) {
        const existing = await tx.cashHandover.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
        if (existing) return existing;
      }
      
      // ENFORCE OWNERSHIP PATH
      if (!ctx.propertyIds.includes(params.propertyId)) {
        throw new ShiftControlError('Access denied to property.', 'FORBIDDEN', 403);
      }
      
      // 1. Fetch POS Sessions
      const posSessions = params.posSessionIds.length > 0 
        ? await tx.posSession.findMany({ where: { id: { in: params.posSessionIds } }, include: { payments: true } })
        : [];
        
      // 2. Fetch FD Sessions
      const fdSessions = params.frontdeskSessionIds.length > 0
        ? await tx.frontdeskSession.findMany({ where: { id: { in: params.frontdeskSessionIds } }, include: { payments: true } })
        : [];

      // 3. Validation: Ownership, Property Isolation, and Status
      let totalAmount = 0;
      let primaryOperatorId = '';
      const paymentBreakdown: Record<string, { amount: number; count: number }> = {};
      const addPayment = (method: string, amount: number) => {
        const key = method || 'OTHER';
        paymentBreakdown[key] = paymentBreakdown[key] || { amount: 0, count: 0 };
        paymentBreakdown[key].amount += amount;
        paymentBreakdown[key].count += 1;
      };
      
      for (const shift of posSessions) {
        if (shift.propertyId !== params.propertyId) throw new ShiftControlError(`Shift ${shift.id} belongs to a different property.`, 'FORBIDDEN', 403);
        if (!primaryOperatorId) primaryOperatorId = shift.openedBy;
        
        if (!['APPROVED', 'APPROVED_WITH_VARIANCE'].includes(shift.controlStatus)) {
          throw new ShiftControlError(`Shift ${shift.id} is not approved. Current status: ${shift.controlStatus}`, 'BAD_REQUEST');
        }
        if (shift.cashHandoverId) throw new ShiftControlError(`Shift ${shift.id} is already in a handover.`, 'BAD_REQUEST');
        
        // Use operator declared cash (actualCash) for custody tracking, since variance was already accepted.
        totalAmount += Number(shift.actualCash || 0);
        for (const payment of shift.payments || []) {
          if (['CONFIRMED', 'PAID'].includes(String(payment.status))) addPayment(String(payment.method), Number(payment.amount));
        }
      }

      for (const shift of fdSessions) {
        if (shift.propertyId !== params.propertyId) throw new ShiftControlError(`Shift ${shift.id} belongs to a different property.`, 'FORBIDDEN', 403);
        if (!primaryOperatorId) primaryOperatorId = shift.staffId;
        
        if (!['APPROVED', 'APPROVED_WITH_VARIANCE'].includes(shift.controlStatus)) {
          throw new ShiftControlError(`Shift ${shift.id} is not approved. Current status: ${shift.controlStatus}`, 'BAD_REQUEST');
        }
        if (shift.cashHandoverId) throw new ShiftControlError(`Shift ${shift.id} is already in a handover.`, 'BAD_REQUEST');
        
        totalAmount += Number(shift.declaredCash || 0);
        for (const payment of shift.payments || []) {
          if (['COMPLETED', 'PARTIALLY_REFUNDED'].includes(String(payment.status))) addPayment(String(payment.method), Number(payment.amount));
        }
      }
      
      // Ensure primaryOperatorId is a Staff ID (POS might store User ID in openedBy)
      let handedOverByStaffId = ctx.userId;
      if (primaryOperatorId) {
        const staff = await tx.staff.findFirst({ where: { OR: [{ id: primaryOperatorId }, { userId: primaryOperatorId }] } });
        if (staff) handedOverByStaffId = staff.id;
      }
      
      if (posSessions.length === 0 && fdSessions.length === 0) {
        throw new ShiftControlError('Must provide at least one shift to handover.', 'BAD_REQUEST');
      }

      // 4. Create Handover Record
      const handover = await tx.cashHandover.create({
        data: {
          id: crypto.randomUUID(),
          propertyId: params.propertyId,
          handoverReference: `HO-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          idempotencyKey: params.idempotencyKey,
          amount: totalAmount,
          paymentBreakdown,
          handedOverById: handedOverByStaffId,
          safeReference: params.safeReference,
          notes: params.notes,
          status: 'PENDING',
        }
      });

      // 5. Link shifts and update their statuses to HANDOVER_PENDING
      if (params.posSessionIds.length > 0) {
        await tx.posSession.updateMany({
          where: { id: { in: params.posSessionIds } },
          data: { 
            cashHandoverId: handover.id,
            controlStatus: 'HANDOVER_PENDING' 
          }
        });
      }

      if (params.frontdeskSessionIds.length > 0) {
        await tx.frontdeskSession.updateMany({
          where: { id: { in: params.frontdeskSessionIds } },
          data: { 
            cashHandoverId: handover.id,
            status: 'HANDOVER_PENDING',
            controlStatus: 'HANDOVER_PENDING'
          }
        });
      }

      // 6. Audit Trail
      for (const id of params.posSessionIds) {
        await this.audit(tx, params.propertyId, ctx.userId, id, undefined, 'HANDOVER_CREATED', 'APPROVED', 'HANDOVER_PENDING', { handoverId: handover.id, amount: totalAmount });
      }
      for (const id of params.frontdeskSessionIds) {
        await this.audit(tx, params.propertyId, ctx.userId, undefined, id, 'HANDOVER_CREATED', 'APPROVED', 'HANDOVER_PENDING', { handoverId: handover.id, amount: totalAmount });
      }

      return handover;
    });
  }

  /**
   * General Cashier receives a pending handover and takes custody of the cash.
   */
  static async receiveHandover(ctx: TenantContext, params: {
    handoverId: string;
    notes?: string;
  }) {
    return prisma.$transaction(async tx => {
      const handover = await tx.cashHandover.findUnique({
        where: { id: params.handoverId },
        include: {
          posSessions: { select: { id: true, controlStatus: true, actualCash: true, outletId: true, bankingModel: true, businessDate: true, outlet: { select: { name: true } } } },
          frontdeskSessions: { select: { id: true, status: true, declaredCash: true, cashAccountId: true, businessDate: true } }
        }
      });

      // ENFORCE OWNERSHIP PATH
      if (!handover || !ctx.propertyIds.includes(handover.propertyId)) throw new ShiftControlError('Handover not found or access denied', 'NOT_FOUND', 404);
      if (handover.status !== 'PENDING') throw new ShiftControlError(`Handover is already ${handover.status}`, 'BAD_REQUEST');
      if (handover.handedOverById === ctx.userId) throw new ShiftControlError('Cannot receive your own handover', 'FORBIDDEN', 403);

      // Verify the receiver has property access (assumed to be done at controller level, but safe to double check)
      
      const updated = await tx.cashHandover.update({
        where: { id: params.handoverId },
        data: {
          status: 'COMPLETED',
          receivedById: ctx.userId,
          receivedAt: new Date(),
          notes: params.notes ? `${handover.notes || ''}\n[Received]: ${params.notes}` : handover.notes
        }
      });

      const controlAccounts = await ensureCashierControlAccountsForClient(ctx, tx, handover.propertyId);
      const safeAccount = controlAccounts.find((account: any) => account.type === 'SAFE');
      if (!safeAccount) throw new ShiftControlError('General Cashier Safe account is unavailable.', 'INTERNAL_ERROR', 500);

      // Post the custody transfer at the moment the physical handover is
      // accepted. Each session gets its own movement for a traceable audit.
      for (const session of handover.frontdeskSessions) {
        const amount = Number(session.declaredCash || 0);
        if (amount <= 0) continue;
        await tx.cashAccount.update({ where: { id: session.cashAccountId }, data: { balance: { decrement: amount } } });
        await tx.cashAccount.update({ where: { id: safeAccount.id }, data: { balance: { increment: amount } } });
        await tx.posCashMovement.create({
          data: {
            propertyId: handover.propertyId,
            deviceId: 'web-cash-management',
            frontdeskSessionId: session.id,
            userId: ctx.userId,
            amount,
            type: 'CASH_TRANSFER_IN',
            sourceAccountId: session.cashAccountId,
            destinationAccountId: safeAccount.id,
            reasonCode: 'CASH_HANDOVER_RECEIVED',
            receiptReference: handover.handoverReference,
            operationId: `handover-received-${handover.id}-${session.id}`,
            businessDate: session.businessDate,
          },
        });
      }

      for (const session of handover.posSessions) {
        const amount = Number(session.actualCash || 0);
        if (amount <= 0) continue;
        const sourceType = session.bankingModel === 'SERVER_BANKING' ? 'SERVER_BANK' : 'STATION_BANK';
        let sourceAccount = await tx.cashAccount.findFirst({
          where: { propertyId: handover.propertyId, outletId: session.outletId, type: sourceType, isActive: true },
        });
        if (!sourceAccount) {
          sourceAccount = await tx.cashAccount.create({
            data: {
              propertyId: handover.propertyId,
              outletId: session.outletId,
              name: `${sourceType === 'SERVER_BANK' ? 'Server Bank' : 'Station Bank'} – ${session.outlet.name}`,
              type: sourceType,
              balance: 0,
              isActive: true,
            },
          });
        }
        await tx.cashAccount.update({ where: { id: sourceAccount.id }, data: { balance: { decrement: amount } } });
        await tx.cashAccount.update({ where: { id: safeAccount.id }, data: { balance: { increment: amount } } });
        await tx.posCashMovement.create({
          data: {
            propertyId: handover.propertyId,
            deviceId: 'web-cash-management',
            posSessionId: session.id,
            userId: ctx.userId,
            amount,
            type: 'CASH_TRANSFER_IN',
            sourceAccountId: sourceAccount.id,
            destinationAccountId: safeAccount.id,
            reasonCode: 'CASH_HANDOVER_RECEIVED',
            receiptReference: handover.handoverReference,
            operationId: `handover-received-${handover.id}-${session.id}`,
            businessDate: session.businessDate,
          },
        });
      }

      // Update linked shifts to HANDED_OVER
      if (handover.posSessions.length > 0) {
        const ids = handover.posSessions.map(s => s.id);
        await tx.posSession.updateMany({
          where: { id: { in: ids } },
          data: { controlStatus: 'HANDED_OVER', handoverAt: new Date() }
        });
        
        for (const session of handover.posSessions) {
          await this.audit(tx, handover.propertyId, ctx.userId, session.id, undefined, 'CASH_RECEIVED', session.controlStatus, 'HANDED_OVER', { handoverId: handover.id });
        }
      }

      if (handover.frontdeskSessions.length > 0) {
        const ids = handover.frontdeskSessions.map(s => s.id);
        await tx.frontdeskSession.updateMany({
          where: { id: { in: ids } },
          data: { status: 'HANDED_OVER', controlStatus: 'HANDED_OVER', handoverAt: new Date() }
        });
        
        for (const session of handover.frontdeskSessions) {
          await this.audit(tx, handover.propertyId, ctx.userId, undefined, session.id, 'CASH_RECEIVED', session.status, 'HANDED_OVER', { handoverId: handover.id });
        }
      }

      // A received handover is automatically prepared as a pending deposit.
      // The bank submission remains manual so the General Cashier can confirm
      // the bank, reference, receipt, and any approved expense deductions.
      const allocations: Array<{ posSessionId?: string; frontdeskSessionId?: string; allocatedAmount: number }> = [
        ...handover.posSessions.map((session) => ({ posSessionId: session.id, allocatedAmount: Number(session.actualCash || 0) })),
        ...handover.frontdeskSessions.map((session) => ({ frontdeskSessionId: session.id, allocatedAmount: Number(session.declaredCash || 0) })),
      ];
      const deposit = await tx.bankDeposit.create({
        data: {
          id: crypto.randomUUID(),
          propertyId: handover.propertyId,
          depositReference: `DEP-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          expectedAmount: handover.amount,
          status: 'PENDING_HANDOVER',
          createdById: ctx.userId,
          allocations: { create: allocations.map((allocation) => ({ ...allocation, id: crypto.randomUUID() })) },
        },
      });
      if (handover.posSessions.length > 0) {
        await tx.posSession.updateMany({ where: { id: { in: handover.posSessions.map((session) => session.id) } }, data: { controlStatus: 'DEPOSIT_PENDING' } });
      }
      if (handover.frontdeskSessions.length > 0) {
        await tx.frontdeskSession.updateMany({ where: { id: { in: handover.frontdeskSessions.map((session) => session.id) } }, data: { status: 'DEPOSIT_PENDING' } });
      }
      for (const allocation of allocations) {
        if (allocation.posSessionId) await this.audit(tx, handover.propertyId, ctx.userId, allocation.posSessionId, undefined, 'DEPOSIT_PREPARED', 'HANDED_OVER', 'DEPOSIT_PENDING', { depositId: deposit.id });
        if (allocation.frontdeskSessionId) await this.audit(tx, handover.propertyId, ctx.userId, undefined, allocation.frontdeskSessionId, 'DEPOSIT_PREPARED', 'HANDED_OVER', 'DEPOSIT_PENDING', { depositId: deposit.id });
      }

      return updated;
    });
  }

  private static async audit(
    tx: any,
    propertyId: string,
    performedBy: string,
    posSessionId?: string,
    frontdeskSessionId?: string,
    action: string = 'HANDOVER_EVENT',
    fromStatus: string = '',
    toStatus: string = '',
    metadata: any = {}
  ) {
    await tx.shiftControlAudit.create({
      data: {
        id: crypto.randomUUID(),
        propertyId,
        posSessionId,
        frontdeskSessionId,
        action,
        fromStatus,
        toStatus,
        performedBy,
        metadata,
        idempotencyKey: `audit_${crypto.randomUUID()}`
      }
    });
  }
}
