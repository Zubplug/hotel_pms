import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { ShiftControlError } from './shift-control-service';
import {
  ensureBankAccountForClient,
  ensureCashierControlAccountsForClient,
} from './cash-account-service';

export class BankDepositService {
  /**
   * General Cashier bundles handed-over shifts into a Bank Deposit.
   */
  static async createDeposit(params: {
    propertyId: string;
    staffId: string;
    posSessionIds: string[];
    frontdeskSessionIds: string[];
    bankName?: string;
    bankAccount?: string;
    notes?: string;
  }) {
    return prisma.$transaction(async tx => {
      const posSessions = params.posSessionIds.length > 0 
        ? await tx.posSession.findMany({ where: { id: { in: params.posSessionIds } } }) : [];
      const fdSessions = params.frontdeskSessionIds.length > 0
        ? await tx.frontdeskSession.findMany({ where: { id: { in: params.frontdeskSessionIds } } }) : [];

      if (posSessions.length === 0 && fdSessions.length === 0) {
        throw new ShiftControlError('Must provide at least one shift to deposit.', 'BAD_REQUEST');
      }

      let expectedAmount = 0;
      const allocationsToCreate: any[] = [];

      for (const shift of posSessions) {
        if (shift.propertyId !== params.propertyId) throw new ShiftControlError(`Shift ${shift.id} belongs to a different property.`, 'FORBIDDEN');
        if (shift.controlStatus !== 'HANDED_OVER') throw new ShiftControlError(`Shift ${shift.id} is not in HANDED_OVER state.`, 'BAD_REQUEST');
        
        // Ensure not already allocated
        const existing = await tx.bankDepositAllocation.findFirst({ where: { posSessionId: shift.id } });
        if (existing) throw new ShiftControlError(`Shift ${shift.id} is already allocated to deposit ${existing.bankDepositId}`, 'BAD_REQUEST');

        // Allocate using the accepted declared amount (actualCash)
        const amt = Number(shift.actualCash || 0);
        expectedAmount += amt;
        allocationsToCreate.push({
          id: crypto.randomUUID(),
          posSessionId: shift.id,
          allocatedAmount: amt
        });
      }

      for (const shift of fdSessions) {
        if (shift.propertyId !== params.propertyId) throw new ShiftControlError(`Shift ${shift.id} belongs to a different property.`, 'FORBIDDEN');
        if (shift.status !== 'HANDED_OVER') throw new ShiftControlError(`Shift ${shift.id} is not in HANDED_OVER state.`, 'BAD_REQUEST');
        
        const existing = await tx.bankDepositAllocation.findFirst({ where: { frontdeskSessionId: shift.id } });
        if (existing) throw new ShiftControlError(`Shift ${shift.id} is already allocated to deposit ${existing.bankDepositId}`, 'BAD_REQUEST');

        const amt = Number(shift.declaredCash || 0);
        expectedAmount += amt;
        allocationsToCreate.push({
          id: crypto.randomUUID(),
          frontdeskSessionId: shift.id,
          allocatedAmount: amt
        });
      }

      const depositId = crypto.randomUUID();
      const deposit = await tx.bankDeposit.create({
        data: {
          id: depositId,
          propertyId: params.propertyId,
          depositReference: `DEP-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          expectedAmount: expectedAmount,
          status: 'PENDING_HANDOVER',
          bankName: params.bankName,
          bankAccount: params.bankAccount,
          createdById: params.staffId,
          notes: params.notes,
          allocations: {
            create: allocationsToCreate.map(a => ({
              id: a.id,
              posSessionId: a.posSessionId,
              frontdeskSessionId: a.frontdeskSessionId,
              allocatedAmount: a.allocatedAmount
            }))
          }
        }
      });

      const controlAccounts = await ensureCashierControlAccountsForClient(tx, params.propertyId);
      const safeAccount = controlAccounts.find((account: any) => account.type === 'SAFE');
      const transitAccount = controlAccounts.find((account: any) => account.type === 'CASH_IN_TRANSIT');
      if (!safeAccount || !transitAccount) {
        throw new ShiftControlError('Cash control accounts are unavailable.', 'INTERNAL_ERROR', 500);
      }
      if (expectedAmount > 0) {
        await tx.cashAccount.update({ where: { id: safeAccount.id }, data: { balance: { decrement: expectedAmount } } });
        await tx.cashAccount.update({ where: { id: transitAccount.id }, data: { balance: { increment: expectedAmount } } });
        await tx.posCashMovement.create({
          data: {
            propertyId: params.propertyId,
            deviceId: 'web-cash-management',
            userId: params.staffId,
            amount: expectedAmount,
            type: 'CASH_TRANSFER_OUT',
            sourceAccountId: safeAccount.id,
            destinationAccountId: transitAccount.id,
            reasonCode: 'BANK_DEPOSIT_CREATED',
            receiptReference: deposit.depositReference,
            operationId: `deposit-created-${deposit.id}`,
          },
        });
      }

      // Update shifts to DEPOSIT_PENDING
      if (params.posSessionIds.length > 0) {
        await tx.posSession.updateMany({ where: { id: { in: params.posSessionIds } }, data: { controlStatus: 'DEPOSIT_PENDING' } });
      }
      if (params.frontdeskSessionIds.length > 0) {
        await tx.frontdeskSession.updateMany({ where: { id: { in: params.frontdeskSessionIds } }, data: { status: 'DEPOSIT_PENDING' } });
      }

      // Audit
      for (const a of allocationsToCreate) {
        if (a.posSessionId) await this.audit(tx, params.propertyId, params.staffId, a.posSessionId, undefined, 'SHIFT_ALLOCATED_TO_DEPOSIT', 'HANDED_OVER', 'DEPOSIT_PENDING', { depositId });
        if (a.frontdeskSessionId) await this.audit(tx, params.propertyId, params.staffId, undefined, a.frontdeskSessionId, 'SHIFT_ALLOCATED_TO_DEPOSIT', 'HANDED_OVER', 'DEPOSIT_PENDING', { depositId });
      }

      return deposit;
    });
  }

  /**
   * General Cashier marks the deposit as sent to the bank.
   */
  static async submitDeposit(params: { depositId: string, staffId: string, bankAccountId: string, bankReceiptUrl?: string, bankReference?: string }) {
    return prisma.$transaction(async tx => {
      const deposit = await tx.bankDeposit.findUnique({ where: { id: params.depositId }, include: { allocations: true } });
      if (!deposit) throw new ShiftControlError('Deposit not found', 'NOT_FOUND', 404);
      if (deposit.status !== 'PENDING_HANDOVER') throw new ShiftControlError(`Deposit cannot be submitted from status ${deposit.status}`, 'BAD_REQUEST');

      const controlAccounts = await ensureCashierControlAccountsForClient(tx, deposit.propertyId);
      const transitAccount = controlAccounts.find((account: any) => account.type === 'CASH_IN_TRANSIT');
      const safeAccount = controlAccounts.find((account: any) => account.type === 'SAFE');
      if (!transitAccount) throw new ShiftControlError('Cash in Transit account is unavailable.', 'INTERNAL_ERROR', 500);
      const bankAccount = await tx.cashAccount.findFirst({ where: { id: params.bankAccountId, propertyId: deposit.propertyId, type: 'BANK_ACCOUNT', isActive: true } });
      if (!bankAccount) throw new ShiftControlError('Select a valid configured bank account.', 'BAD_REQUEST');

      const updated = await tx.bankDeposit.update({
        where: { id: params.depositId },
        data: {
          status: 'DEPOSITED',
          submittedById: params.staffId,
          submittedAt: new Date(),
          depositedAt: new Date(),
          bankReceiptUrl: params.bankReceiptUrl || deposit.bankReceiptUrl,
          bankReference: params.bankReference || deposit.bankReference,
          bankName: bankAccount.bankName || deposit.bankName,
          bankAccount: bankAccount.accountNumber || deposit.bankAccount,
          bankAccountId: bankAccount.id,
        }
      });

      const amount = Number(deposit.expectedAmount);
      if (amount > 0) {
        // Automatically prepared deposits remain in the General Cashier Safe
        // until submission. Legacy/manual deposits may already be staged in
        // Cash in Transit, so support both paths idempotently.
        const sourceAccount = Number(transitAccount.balance) >= amount ? transitAccount : safeAccount;
        if (!sourceAccount) throw new ShiftControlError('General Cashier Safe account is unavailable.', 'INTERNAL_ERROR', 500);
        if (sourceAccount.id !== transitAccount.id) {
          await tx.cashAccount.update({ where: { id: sourceAccount.id }, data: { balance: { decrement: amount } } });
          await tx.cashAccount.update({ where: { id: transitAccount.id }, data: { balance: { increment: amount } } });
          await tx.posCashMovement.create({
            data: {
              propertyId: deposit.propertyId,
              deviceId: 'web-cash-management',
              userId: params.staffId,
              amount,
              type: 'CASH_TRANSFER_OUT',
              sourceAccountId: sourceAccount.id,
              destinationAccountId: transitAccount.id,
              reasonCode: 'BANK_DEPOSIT_STAGED',
              receiptReference: deposit.depositReference,
              operationId: `deposit-staged-${deposit.id}`,
            },
          });
        }
        await tx.cashAccount.update({ where: { id: transitAccount.id }, data: { balance: { decrement: amount } } });
        await tx.cashAccount.update({ where: { id: bankAccount.id }, data: { balance: { increment: amount } } });
        await tx.posCashMovement.create({
          data: {
            propertyId: deposit.propertyId,
            deviceId: 'web-cash-management',
            userId: params.staffId,
            amount,
            type: 'CASH_TRANSFER_OUT',
            sourceAccountId: transitAccount.id,
            destinationAccountId: bankAccount.id,
            reasonCode: 'BANK_DEPOSIT_SUBMITTED',
            receiptReference: params.bankReference || deposit.depositReference,
            operationId: `deposit-submitted-${deposit.id}`,
          },
        });
      }

      // Update shifts
      for (const a of deposit.allocations) {
        if (a.posSessionId) {
          await tx.posSession.update({ where: { id: a.posSessionId }, data: { controlStatus: 'DEPOSITED' } });
          await this.audit(tx, deposit.propertyId, params.staffId, a.posSessionId, undefined, 'DEPOSIT_SUBMITTED', 'DEPOSIT_PENDING', 'DEPOSITED', { depositId: deposit.id });
        }
        if (a.frontdeskSessionId) {
          await tx.frontdeskSession.update({ where: { id: a.frontdeskSessionId }, data: { status: 'DEPOSITED', controlStatus: 'DEPOSITED', depositedAt: new Date() } });
          await this.audit(tx, deposit.propertyId, params.staffId, undefined, a.frontdeskSessionId, 'DEPOSIT_SUBMITTED', 'DEPOSIT_PENDING', 'DEPOSITED', { depositId: deposit.id });
        }
      }

      return updated;
    });
  }

  /**
   * Finance Manager starts verification of the deposit.
   */
  static async startVerification(params: { depositId: string, staffId: string }) {
    return prisma.$transaction(async tx => {
      const deposit = await tx.bankDeposit.findUnique({ where: { id: params.depositId }, include: { allocations: true } });
      if (!deposit) throw new ShiftControlError('Deposit not found', 'NOT_FOUND', 404);
      if (deposit.status !== 'DEPOSITED') throw new ShiftControlError(`Cannot start verification from status ${deposit.status}`, 'BAD_REQUEST');

      const updated = await tx.bankDeposit.update({
        where: { id: params.depositId },
        data: {
          status: 'UNDER_RECONCILIATION',
          verifiedById: params.staffId,
          verifiedAt: new Date()
        }
      });

      for (const a of deposit.allocations) {
        if (a.posSessionId) {
          await tx.posSession.update({ where: { id: a.posSessionId }, data: { controlStatus: 'UNDER_RECONCILIATION' } });
          await this.audit(tx, deposit.propertyId, params.staffId, a.posSessionId, undefined, 'DEPOSIT_VERIFICATION_STARTED', 'DEPOSITED', 'UNDER_RECONCILIATION', { depositId: deposit.id });
        }
        if (a.frontdeskSessionId) {
          await tx.frontdeskSession.update({ where: { id: a.frontdeskSessionId }, data: { status: 'UNDER_RECONCILIATION' } });
          await this.audit(tx, deposit.propertyId, params.staffId, undefined, a.frontdeskSessionId, 'DEPOSIT_VERIFICATION_STARTED', 'DEPOSITED', 'UNDER_RECONCILIATION', { depositId: deposit.id });
        }
      }
      return updated;
    });
  }

  /**
   * Finance Manager completes verification. If bank amount != expected amount, marks as EXCEPTION.
   */
  static async verifyAndReconcile(params: { depositId: string, staffId: string, bankConfirmedAmount: number, notes?: string }) {
    return prisma.$transaction(async tx => {
      const deposit = await tx.bankDeposit.findUnique({ where: { id: params.depositId }, include: { allocations: true } });
      if (!deposit) throw new ShiftControlError('Deposit not found', 'NOT_FOUND', 404);
      if (!['UNDER_RECONCILIATION', 'EXCEPTION'].includes(deposit.status)) throw new ShiftControlError(`Cannot reconcile from status ${deposit.status}`, 'BAD_REQUEST');

      const expected = Number(deposit.expectedAmount);
      const diff = params.bankConfirmedAmount - expected;
      const isException = diff !== 0;

      const updated = await tx.bankDeposit.update({
        where: { id: params.depositId },
        data: {
          status: isException ? 'EXCEPTION' : 'RECONCILED',
          bankConfirmedAmount: params.bankConfirmedAmount,
          difference: diff,
          reconciledById: isException ? null : params.staffId,
          reconciledAt: isException ? null : new Date(),
          notes: params.notes ? `${deposit.notes || ''}\n[Reconciliation]: ${params.notes}` : deposit.notes
        }
      });

      for (const a of deposit.allocations) {
        const toStatus = isException ? 'EXCEPTION' : 'RECONCILED';
        if (a.posSessionId) {
          await tx.posSession.update({ where: { id: a.posSessionId }, data: { controlStatus: toStatus } });
          await this.audit(tx, deposit.propertyId, params.staffId, a.posSessionId, undefined, isException ? 'DEPOSIT_EXCEPTION_CREATED' : 'DEPOSIT_RECONCILED', 'UNDER_RECONCILIATION', toStatus, { depositId: deposit.id, diff });
        }
        if (a.frontdeskSessionId) {
          await tx.frontdeskSession.update({ where: { id: a.frontdeskSessionId }, data: { status: toStatus } });
          await this.audit(tx, deposit.propertyId, params.staffId, undefined, a.frontdeskSessionId, isException ? 'DEPOSIT_EXCEPTION_CREATED' : 'DEPOSIT_RECONCILED', 'UNDER_RECONCILIATION', toStatus, { depositId: deposit.id, diff });
        }
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
    action: string = 'DEPOSIT_EVENT',
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
