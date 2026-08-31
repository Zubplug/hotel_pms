import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { ShiftControlError } from './shift-control-service';
import {
  ensureCashierControlAccountsForClient,
  ensureExpenseCounterpartyForClient,
} from './cash-account-service';
import { TenantContext } from '../organization-access';
type ExpenseInput = {
  propertyId: string;
  amount: number;
  currency?: string;
  categoryId: string;
  description: string;
  payee: string;
  receiptUrl?: string;
  costCenterId?: string;
};

export class CashExpenseService {
  static async list(ctx: TenantContext, propertyIds?: string[]) {
    // If specific propertyIds provided, restrict them to authorized scope.
    // Otherwise return all authorized properties.
    const scopedIds = propertyIds
      ? propertyIds.filter(id => ctx.propertyIds.includes(id))
      : ctx.propertyIds;

    if (scopedIds.length === 0) return [];

    return prisma.cashExpense.findMany({
      where: { propertyId: { in: scopedIds as string[] } },
      orderBy: { createdAt: 'desc' },
      include: { journal: true, audits: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
  }

  static async create(ctx: TenantContext, input: ExpenseInput) {
    if (!ctx.propertyIds.includes(input.propertyId)) {
      throw new ShiftControlError('Access denied to property.', 'FORBIDDEN');
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ShiftControlError('Expense amount must be greater than zero.', 'BAD_REQUEST');
    }
    for (const [label, value] of Object.entries({ categoryId: input.categoryId, description: input.description, payee: input.payee })) {
      if (!value?.trim()) throw new ShiftControlError(`${label} is required.`, 'BAD_REQUEST');
    }

    return prisma.$transaction(async (tx) => {
      const category = await tx.expenseCategory.findFirst({ where: { id: input.categoryId, propertyId: input.propertyId, isActive: true } });
      if (!category) throw new ShiftControlError('Select an active expense category configured for this property.', 'BAD_REQUEST');
      let costCenter: { id: string; name: string } | null = null;
      if (input.costCenterId) {
        costCenter = await tx.costCenter.findFirst({ where: { id: input.costCenterId, propertyId: input.propertyId, isActive: true }, select: { id: true, name: true } });
        if (!costCenter) throw new ShiftControlError('Select an active cost centre configured for this property.', 'BAD_REQUEST');
      }
      const expense = await tx.cashExpense.create({
        data: {
          propertyId: input.propertyId,
          expenseReference: `EXP-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          status: 'PENDING_APPROVAL',
          amount: input.amount,
          currency: input.currency || 'NGN',
          category: category.name,
          categoryId: category.id,
          description: input.description.trim(),
          payee: input.payee.trim(),
          receiptUrl: input.receiptUrl?.trim() || null,
          costCenter: costCenter?.name || null,
          costCenterId: costCenter?.id || null,
          requestedBy: ctx.userId,
        },
      });
      await this.audit(tx, expense.id, ctx.userId, 'SUBMITTED', 'Expense submitted for approval');
      return expense;
    });
  }

  static async approve(ctx: TenantContext, expenseId: string, notes?: string) {
    return prisma.$transaction(async (tx) => {
      // ENFORCE OWNERSHIP PATH
      const expense = await tx.cashExpense.findUnique({ where: { id: expenseId } });
      if (!expense || !ctx.propertyIds.includes(expense.propertyId)) throw new ShiftControlError('Expense not found or access denied', 'NOT_FOUND', 404);
      if (expense.status !== 'PENDING_APPROVAL') throw new ShiftControlError(`Expense is already ${expense.status}.`, 'BAD_REQUEST');
      const updated = await tx.cashExpense.update({ where: { id: expenseId }, data: { status: 'APPROVED', approvedBy: ctx.userId, approvedAt: new Date(), approvalNotes: notes?.trim() || null } });
      await this.audit(tx, expense.id, ctx.userId, 'APPROVED', notes);
      return updated;
    });
  }

  static async reject(ctx: TenantContext, expenseId: string, reason: string) {
    if (!reason?.trim()) throw new ShiftControlError('A rejection reason is required.', 'BAD_REQUEST');
    return prisma.$transaction(async (tx) => {
      // ENFORCE OWNERSHIP PATH
      const expense = await tx.cashExpense.findUnique({ where: { id: expenseId } });
      if (!expense || !ctx.propertyIds.includes(expense.propertyId)) throw new ShiftControlError('Expense not found or access denied', 'NOT_FOUND', 404);
      if (expense.status !== 'PENDING_APPROVAL') throw new ShiftControlError(`Expense is already ${expense.status}.`, 'BAD_REQUEST');
      const updated = await tx.cashExpense.update({ where: { id: expenseId }, data: { status: 'REJECTED', rejectionReason: reason.trim(), rejectedAt: new Date() } });
      await this.audit(tx, expense.id, ctx.userId, 'REJECTED', reason.trim());
      return updated;
    });
  }

  static async pay(ctx: TenantContext, expenseId: string) {
    return prisma.$transaction(async (tx) => {
      // ENFORCE OWNERSHIP PATH
      const expense = await tx.cashExpense.findUnique({ where: { id: expenseId } });
      if (!expense || !ctx.propertyIds.includes(expense.propertyId)) throw new ShiftControlError('Expense not found or access denied', 'NOT_FOUND', 404);
      if (expense.status !== 'APPROVED') throw new ShiftControlError(`Only approved expenses can be paid. Current status: ${expense.status}.`, 'BAD_REQUEST');
      
      const accounts = await ensureCashierControlAccountsForClient(ctx, tx, expense.propertyId);
      const safe = accounts.find((account: any) => account.type === 'SAFE');
      if (!safe) throw new ShiftControlError('General Cashier Safe account is unavailable.', 'INTERNAL_ERROR', 500);
      const clearing = await ensureExpenseCounterpartyForClient(ctx, tx, expense.propertyId);
      const amount = Number(expense.amount);

      if (Number(safe.balance) < amount) {
        throw new ShiftControlError('Insufficient balance in the General Cashier Safe.', 'BAD_REQUEST');
      }

      // Pending deposits are created automatically after handover. An expense
      // paid before banking must reduce the amount still expected at the bank;
      // otherwise the hotel could submit more cash than it holds.
      let remainingExpense = amount;
      const pendingDeposits = await tx.bankDeposit.findMany({
        where: { propertyId: expense.propertyId, status: 'PENDING_HANDOVER', expectedAmount: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, depositReference: true, expectedAmount: true, notes: true },
      });
      for (const deposit of pendingDeposits) {
        if (remainingExpense <= 0) break;
        const reduction = Math.min(remainingExpense, Number(deposit.expectedAmount));
        await tx.bankDeposit.update({ where: { id: deposit.id }, data: { expectedAmount: { decrement: reduction }, notes: `${deposit.notes || ''}\n[Expense deducted ${expense.expenseReference}]: ${reduction.toFixed(2)}`.trim() } });
        await this.audit(tx, expense.id, ctx.userId, 'DEPOSIT_ADJUSTED', `Reduced ${deposit.depositReference} by ${reduction.toFixed(2)}`, { depositId: deposit.id, amount: reduction });
        remainingExpense -= reduction;
      }

      await tx.cashAccount.update({ where: { id: safe.id }, data: { balance: { decrement: amount } } });
      await tx.cashAccount.update({ where: { id: clearing.id }, data: { balance: { increment: amount } } });
      const updated = await tx.cashExpense.update({ where: { id: expense.id }, data: { status: 'PAID', paidBy: ctx.userId, paidAt: new Date(), cashAccountId: safe.id } });
      await tx.posCashMovement.create({
        data: {
          propertyId: expense.propertyId,
          deviceId: 'web-cash-management',
          userId: ctx.userId,
          amount,
          type: 'CASH_TRANSFER_OUT',
          sourceAccountId: safe.id,
          destinationAccountId: clearing.id,
          reasonCode: 'CASH_EXPENSE_PAID',
          receiptReference: expense.expenseReference,
          operationId: `expense-paid-${expense.id}`,
        },
      });
      const category = await tx.expenseCategory.findUnique({ where: { id: expense.categoryId! }, select: { debitAccount: true } });
      await tx.cashExpenseJournal.create({ data: { expenseId: expense.id, debitAccount: category?.debitAccount || `EXPENSE:${expense.category}`, creditAccount: 'CASH:GENERAL_CASHIER_SAFE', amount, currency: expense.currency, postedBy: ctx.userId } });
      await this.audit(tx, expense.id, ctx.userId, 'PAID', `Paid from ${safe.name}`);
      return updated;
    });
  }

  private static async audit(tx: any, expenseId: string, performedBy: string, action: string, notes?: string, metadata?: Record<string, unknown>) {
    return tx.cashExpenseAudit.create({ data: { id: crypto.randomUUID(), expenseId, action, performedBy, notes: notes || null, metadata: metadata || undefined } });
  }
}
