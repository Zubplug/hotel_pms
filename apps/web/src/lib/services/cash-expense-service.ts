import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { ShiftControlError } from './shift-control-service';
import {
  ensureCashierControlAccountsForClient,
  ensureExpenseCounterpartyForClient,
} from './cash-account-service';
import { TenantContext } from '../organization-access';
import { GeneralLedgerService } from './general-ledger-service';
type ExpenseInput = {
  propertyId: string;
  amount: number;
  currency?: string;
  categoryId: string;
  description: string;
  payee: string;
  receiptUrl?: string;
  costCenterId?: string;
  items?: Array<{ description: string; unit?: string; quantity: number; unitPrice: number }>;
};

export const EXPENSE_APPROVAL_STAGES = ['GENERAL_CASHIER', 'ACCOUNTANT', 'GENERAL_MANAGER'] as const;
export type ExpenseApprovalStage = typeof EXPENSE_APPROVAL_STAGES[number];
export type ExpensePaymentMethod = 'CASH' | 'BANK_TRANSFER';

const nextStatus: Record<ExpenseApprovalStage, string> = {
  GENERAL_CASHIER: 'AWAITING_ACCOUNTANT_APPROVAL',
  ACCOUNTANT: 'AWAITING_GENERAL_MANAGER_APPROVAL',
  GENERAL_MANAGER: 'APPROVED',
};

function stageForRole(role: string): ExpenseApprovalStage | null {
  const normalized = role.toUpperCase();
  if (normalized === 'GENERAL_CASHIER') return 'GENERAL_CASHIER';
  if (normalized === 'ACCOUNTANT' || normalized === 'FINANCE_MANAGER') return 'ACCOUNTANT';
  if (normalized === 'GENERAL_MANAGER' || normalized === 'HOTEL_MANAGER' || normalized === 'CEO') return 'GENERAL_MANAGER';
  return null;
}

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
      include: { journal: true, approvals: { orderBy: { createdAt: 'asc' } }, lineItems: { orderBy: { createdAt: 'asc' } }, cashAccount: true, audits: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
  }

  static async create(ctx: TenantContext, input: ExpenseInput) {
    if (!ctx.propertyIds.includes(input.propertyId)) {
      throw new ShiftControlError('Access denied to property.', 'FORBIDDEN');
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ShiftControlError('Expense amount must be greater than zero.', 'BAD_REQUEST');
    }
    const items = (input.items || []).map(item => ({ description: item.description.trim(), unit: item.unit?.trim() || null, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), total: Number(item.quantity) * Number(item.unitPrice) }));
    if (items.length > 0) {
      if (items.some(item => !item.description || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) throw new ShiftControlError('Every invoice line must have a description, positive quantity, and valid unit price.', 'BAD_REQUEST');
      const itemTotal = items.reduce((sum, item) => sum + item.total, 0);
      if (Math.abs(itemTotal - input.amount) > 0.01) throw new ShiftControlError('The expense total must equal the sum of invoice line items.', 'BAD_REQUEST');
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
          currentApprovalStage: 'GENERAL_CASHIER',
        },
      });
      await tx.cashExpenseApproval.createMany({
        data: EXPENSE_APPROVAL_STAGES.map(stage => ({ expenseId: expense.id, stage, status: 'PENDING' })),
      });
      if (items.length > 0) await tx.cashExpenseLineItem.createMany({ data: items.map(item => ({ expenseId: expense.id, ...item })) });
      await this.audit(tx, expense.id, ctx.userId, 'SUBMITTED', 'Expense submitted for approval');
      return expense;
    });
  }

  static async approve(ctx: TenantContext, expenseId: string, role: string, notes?: string) {
    const stage = stageForRole(role);
    if (!stage && role !== 'SUPER_ADMIN') throw new ShiftControlError('This role cannot approve controlled expenses.', 'FORBIDDEN', 403);
    return prisma.$transaction(async (tx) => {
      const expense = await tx.cashExpense.findUnique({ where: { id: expenseId }, include: { approvals: true } });
      if (!expense || !ctx.propertyIds.includes(expense.propertyId)) throw new ShiftControlError('Expense not found or access denied', 'NOT_FOUND', 404);
      const currentStage = (expense.currentApprovalStage || EXPENSE_APPROVAL_STAGES.find(candidate => expense.approvals.find(item => item.stage === candidate)?.status === 'PENDING')) as ExpenseApprovalStage | undefined;
      if (!currentStage || !EXPENSE_APPROVAL_STAGES.includes(currentStage)) throw new ShiftControlError(`Expense is already ${expense.status}.`, 'BAD_REQUEST');
      if (role !== 'SUPER_ADMIN' && stage !== currentStage) throw new ShiftControlError(`This expense is awaiting ${currentStage.replaceAll('_', ' ').toLowerCase()}.`, 'BAD_REQUEST');
      const approval = expense.approvals.find(item => item.stage === currentStage);
      if (!approval || approval.status !== 'PENDING') throw new ShiftControlError(`The ${currentStage.replaceAll('_', ' ')} approval has already been completed.`, 'BAD_REQUEST');
      const now = new Date();
      await tx.cashExpenseApproval.update({ where: { id: approval.id }, data: { status: 'APPROVED', approverId: ctx.userId, actedAt: now, notes: notes?.trim() || null } });
      const updated = await tx.cashExpense.update({ where: { id: expenseId }, data: { status: nextStatus[currentStage], currentApprovalStage: currentStage === 'GENERAL_MANAGER' ? null : nextStatus[currentStage].replace('AWAITING_', '').replace('_APPROVAL', ''), approvedBy: currentStage === 'GENERAL_MANAGER' ? ctx.userId : expense.approvedBy, approvedAt: currentStage === 'GENERAL_MANAGER' ? now : expense.approvedAt, approvalNotes: notes?.trim() || expense.approvalNotes } });
      await this.audit(tx, expense.id, ctx.userId, `${currentStage}_APPROVED`, notes || `${currentStage.replaceAll('_', ' ')} approval completed`);
      return updated;
    });
  }

  static async reject(ctx: TenantContext, expenseId: string, role: string, reason: string) {
    if (!reason?.trim()) throw new ShiftControlError('A rejection reason is required.', 'BAD_REQUEST');
    const stage = stageForRole(role);
    if (!stage && role !== 'SUPER_ADMIN') throw new ShiftControlError('This role cannot reject controlled expenses.', 'FORBIDDEN', 403);
    return prisma.$transaction(async (tx) => {
      const expense = await tx.cashExpense.findUnique({ where: { id: expenseId }, include: { approvals: true } });
      if (!expense || !ctx.propertyIds.includes(expense.propertyId)) throw new ShiftControlError('Expense not found or access denied', 'NOT_FOUND', 404);
      const currentStage = (expense.currentApprovalStage || EXPENSE_APPROVAL_STAGES.find(candidate => expense.approvals.find(item => item.stage === candidate)?.status === 'PENDING')) as ExpenseApprovalStage | undefined;
      if (!currentStage || (role !== 'SUPER_ADMIN' && stage !== currentStage)) throw new ShiftControlError('This expense is not awaiting your approval stage.', 'BAD_REQUEST');
      const approval = expense.approvals.find(item => item.stage === currentStage);
      if (!approval || approval.status !== 'PENDING') throw new ShiftControlError('This approval stage is already complete.', 'BAD_REQUEST');
      await tx.cashExpenseApproval.update({ where: { id: approval.id }, data: { status: 'REJECTED', approverId: ctx.userId, actedAt: new Date(), notes: reason.trim() } });
      const updated = await tx.cashExpense.update({ where: { id: expenseId }, data: { status: 'REJECTED', rejectionReason: reason.trim(), rejectedAt: new Date() } });
      await this.audit(tx, expense.id, ctx.userId, `${currentStage}_REJECTED`, reason.trim());
      return updated;
    });
  }

  static async pay(ctx: TenantContext, expenseId: string, input: { method: ExpensePaymentMethod; bankAccountId?: string; paymentReference?: string }) {
    return prisma.$transaction(async (tx) => {
      // ENFORCE OWNERSHIP PATH
      const expense = await tx.cashExpense.findUnique({ where: { id: expenseId } });
      if (!expense || !ctx.propertyIds.includes(expense.propertyId)) throw new ShiftControlError('Expense not found or access denied', 'NOT_FOUND', 404);
      if (expense.status !== 'APPROVED' || expense.currentApprovalStage) throw new ShiftControlError(`Only expenses approved by all three control roles can be released. Current status: ${expense.status}.`, 'BAD_REQUEST');

      const accounts = await ensureCashierControlAccountsForClient(ctx, tx, expense.propertyId);
      const safe = accounts.find((account: any) => account.type === 'SAFE');
      if (!safe) throw new ShiftControlError('General Cashier Safe account is unavailable.', 'INTERNAL_ERROR', 500);
      const clearing = await ensureExpenseCounterpartyForClient(ctx, tx, expense.propertyId);
      const amount = Number(expense.amount);

      const method = input.method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : input.method === 'CASH' ? 'CASH' : null;
      if (!method) throw new ShiftControlError('Select CASH or BANK_TRANSFER as the release method.', 'BAD_REQUEST');
      if (method === 'BANK_TRANSFER' && !input.paymentReference?.trim()) throw new ShiftControlError('A bank transfer reference is required.', 'BAD_REQUEST');
      const source = method === 'CASH'
        ? safe
        : await tx.cashAccount.findFirst({ where: { id: input.bankAccountId, propertyId: expense.propertyId, type: 'BANK_ACCOUNT', isActive: true } });
      if (!source) throw new ShiftControlError('Select an active bank account for this transfer.', 'BAD_REQUEST');

      if (Number(source.balance) < amount) {
        throw new ShiftControlError(`Insufficient balance in ${source.name}.`, 'BAD_REQUEST');
      }

      // Pending deposits are created automatically after handover. An expense
      // paid before banking must reduce the amount still expected at the bank;
      // otherwise the hotel could submit more cash than it holds.
      let remainingExpense = method === 'CASH' ? amount : 0;
      const pendingDeposits = method === 'CASH' ? await tx.bankDeposit.findMany({
        where: { propertyId: expense.propertyId, status: 'PENDING_HANDOVER', expectedAmount: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, depositReference: true, expectedAmount: true, notes: true },
      }) : [];
      for (const deposit of pendingDeposits) {
        if (remainingExpense <= 0) break;
        const reduction = Math.min(remainingExpense, Number(deposit.expectedAmount));
        await tx.bankDeposit.update({ where: { id: deposit.id }, data: { expectedAmount: { decrement: reduction }, notes: `${deposit.notes || ''}\n[Expense deducted ${expense.expenseReference}]: ${reduction.toFixed(2)}`.trim() } });
        await this.audit(tx, expense.id, ctx.userId, 'DEPOSIT_ADJUSTED', `Reduced ${deposit.depositReference} by ${reduction.toFixed(2)}`, { depositId: deposit.id, amount: reduction });
        remainingExpense -= reduction;
      }

      await tx.cashAccount.update({ where: { id: source.id }, data: { balance: { decrement: amount } } });
      await tx.cashAccount.update({ where: { id: clearing.id }, data: { balance: { increment: amount } } });
      const updated = await tx.cashExpense.update({ where: { id: expense.id }, data: { status: 'PAID', paidBy: ctx.userId, paidAt: new Date(), cashAccountId: source.id, paymentMethod: method, paymentReference: input.paymentReference?.trim() || null } });
      await tx.posCashMovement.create({
        data: {
          propertyId: expense.propertyId,
          deviceId: 'web-cash-management',
          userId: ctx.userId,
          amount,
          type: 'CASH_TRANSFER_OUT',
          sourceAccountId: source.id,
          destinationAccountId: clearing.id,
          reasonCode: 'CASH_EXPENSE_PAID',
          receiptReference: expense.expenseReference,
          operationId: `expense-paid-${expense.id}`,
        },
      });
      const category = await tx.expenseCategory.findUnique({ where: { id: expense.categoryId! } });
      if (!category) throw new ShiftControlError('Expense category not found.', 'INTERNAL_ERROR', 500);

      const expenseGlAccount = await tx.chartOfAccount.findFirst({
        where: { propertyId: expense.propertyId, code: category.debitAccount, isActive: true }
      });

      if (!expenseGlAccount) throw new ShiftControlError(`Expense category is mapped to GL Account Code ${category.debitAccount}, but that account is missing or inactive.`, 'BAD_REQUEST', 400);
      if (!source.glAccountId) throw new ShiftControlError(`The release account (${source.name}) must be mapped to a GL Chart of Account.`, 'BAD_REQUEST', 400);

      await tx.cashExpenseJournal.create({ data: { expenseId: expense.id, debitAccount: category.debitAccount, creditAccount: `CASH:${source.name}`, amount, currency: expense.currency, postedBy: ctx.userId } });

      await GeneralLedgerService.postJournal(ctx, {
          propertyId: expense.propertyId,
          entryDate: new Date(),
          description: `Cash Expense: ${expense.expenseReference}${expense.payee ? ` - Paid to ${expense.payee}` : ''}`,
          reference: expense.expenseReference,
          sourceModule: 'CASH_MANAGEMENT',
          lines: [
            { accountId: expenseGlAccount.id, debit: amount, credit: 0, description: `Cash Expense - ${category.name}`, sourceType: 'CASH_EXPENSE', sourceId: expense.id },
            { accountId: source.glAccountId, debit: 0, credit: amount, description: `${method === 'CASH' ? 'Cash' : 'Bank transfer'} expense release`, sourceType: 'CASH_EXPENSE', sourceId: expense.id }
          ]
      }, tx);
      await this.audit(tx, expense.id, ctx.userId, 'PAID', `Released by ${method === 'CASH' ? safe.name : source.name}`, { method, paymentReference: input.paymentReference || null });
      return updated;
    });
  }

  private static async audit(tx: any, expenseId: string, performedBy: string, action: string, notes?: string, metadata?: Record<string, unknown>) {
    return tx.cashExpenseAudit.create({ data: { id: crypto.randomUUID(), expenseId, action, performedBy, notes: notes || null, metadata: metadata || undefined } });
  }
}
