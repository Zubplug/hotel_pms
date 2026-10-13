import prisma from '@hotel-pms/db';
import { createFlutterwaveTransfer, resolveFlutterwaveBankAccount } from '@hotel-pms/db';
import { getFlutterwavePayrollIntegration } from './flutterwave-payroll-service';
import { GeneralLedgerService } from './general-ledger-service';
import { ensureCashierControlAccountsForClient, ensureExpenseCounterpartyForClient } from './cash-account-service';
import { TenantContext } from '../organization-access';

export const REIMBURSEMENT_STAGES = ['HR_REVIEW', 'ACCOUNTANT_REVIEW', 'GENERAL_MANAGER_REVIEW', 'APPROVED_FOR_PAYMENT', 'REIMBURSED'] as const;
export type ReimbursementStage = typeof REIMBURSEMENT_STAGES[number];

const roleForStage: Record<string, ReimbursementStage> = {
  HR_MANAGER: 'HR_REVIEW', HR_OFFICER: 'HR_REVIEW', ADMIN: 'HR_REVIEW',
  ACCOUNTANT: 'ACCOUNTANT_REVIEW', FINANCE_MANAGER: 'ACCOUNTANT_REVIEW',
  GENERAL_MANAGER: 'GENERAL_MANAGER_REVIEW', HOTEL_MANAGER: 'GENERAL_MANAGER_REVIEW', CEO: 'GENERAL_MANAGER_REVIEW',
};

export function reimbursementStageForRole(role: string) {
  return roleForStage[String(role).toUpperCase()] || null;
}

export function reimbursementCanSeeAll(role: string) {
  return ['HR_MANAGER', 'HR_OFFICER', 'ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'CEO', 'GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'].includes(String(role).toUpperCase());
}

export class EmployeeExpenseReimbursementService {
  static async autoSettleBankClaim(ctx: TenantContext, id: string) {
    const claim = await prisma.expenseClaim.findFirst({ where: { id, propertyId: { in: [...ctx.propertyIds], }, status: 'APPROVED_FOR_PAYMENT' }, include: { staff: { include: { salaryStructure: true } }, property: { select: { organizationId: true, autoBankReimbursementEnabled: true } } } });
    if (!claim || claim.requestedPaymentMethod !== 'BANK_TRANSFER' || !claim.property.autoBankReimbursementEnabled) return null;
    const salary = claim.staff.salaryStructure;
    if (!salary?.bankAccountNumber || !salary.bankSortCode || !salary.bankName) {
      return prisma.expenseClaim.update({ where: { id }, data: { autoPaymentStatus: 'MANUAL_REQUIRED' } });
    }
    const integration = await getFlutterwavePayrollIntegration(claim.property.organizationId, claim.propertyId);
    if (!integration) return prisma.expenseClaim.update({ where: { id }, data: { autoPaymentStatus: 'MANUAL_REQUIRED' } });
    const reference = `REIMB-${claim.claimNumber}-${Date.now()}`;
    await prisma.expenseClaim.update({ where: { id }, data: { autoPaymentStatus: 'PROCESSING', paymentReference: reference } });
    try {
      const beneficiary = await resolveFlutterwaveBankAccount({ secretKey: integration.credentials.secretKey, accountNumber: salary.bankAccountNumber, bankCode: salary.bankSortCode });
      const transfer = await createFlutterwaveTransfer({ secretKey: integration.credentials.secretKey, amount: Number(claim.amount), currency: claim.currency, bankCode: salary.bankSortCode, accountNumber: salary.bankAccountNumber, beneficiaryName: beneficiary.account_name || salary.bankAccountName || `${claim.staff.firstName} ${claim.staff.lastName}`, reference, narration: `LodgeCore employee reimbursement ${claim.claimNumber}`, meta: { expenseClaimId: claim.id, claimNumber: claim.claimNumber } });
      if (!['SUCCESSFUL', 'COMPLETED'].includes(String(transfer.status).toUpperCase())) {
        return prisma.expenseClaim.update({ where: { id }, data: { autoPaymentStatus: 'PROCESSING', paymentReference: String(transfer.reference || reference) } });
      }
      const bankAccount = await prisma.cashAccount.findFirst({ where: { propertyId: claim.propertyId, type: 'BANK_ACCOUNT', isActive: true, isDefault: true }, select: { id: true } }) || await prisma.cashAccount.findFirst({ where: { propertyId: claim.propertyId, type: 'BANK_ACCOUNT', isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      if (!bankAccount) return prisma.expenseClaim.update({ where: { id }, data: { autoPaymentStatus: 'MANUAL_REQUIRED' } });
      const settled = await this.pay(ctx, id, { method: 'BANK_TRANSFER', bankAccountId: bankAccount.id, paymentReference: String(transfer.reference || reference) });
      return prisma.expenseClaim.update({ where: { id: settled.id }, data: { autoPaymentStatus: 'SUCCESSFUL' } });
    } catch (error) {
      console.error('Automatic employee reimbursement transfer failed:', error);
      return prisma.expenseClaim.update({ where: { id }, data: { autoPaymentStatus: 'MANUAL_REQUIRED' } });
    }
  }

  static async approve(id: string, actor: { userId: string; role: string; propertyId: string }) {
    const stage = reimbursementStageForRole(actor.role);
    if (!stage) throw new Error('This role cannot approve employee reimbursements.');
    return prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.findFirst({ where: { id, propertyId: actor.propertyId } });
      if (!claim) throw new Error('Expense claim not found.');
      if (claim.status !== stage) throw new Error(`This claim is not awaiting ${stage.replaceAll('_', ' ').toLowerCase()}.`);
      const now = new Date();
      if (stage === 'HR_REVIEW') return tx.expenseClaim.update({ where: { id }, data: { status: 'ACCOUNTANT_REVIEW', hrReviewedBy: actor.userId, hrReviewedAt: now } });
      if (stage === 'ACCOUNTANT_REVIEW') return tx.expenseClaim.update({ where: { id }, data: { status: 'GENERAL_MANAGER_REVIEW', accountantReviewedBy: actor.userId, accountantReviewedAt: now } });
      return tx.expenseClaim.update({ where: { id }, data: { status: 'APPROVED_FOR_PAYMENT', managerApprovedBy: actor.userId, managerApprovedAt: now, approvedBy: actor.userId, approvedAt: now } });
    });
  }

  static async reject(id: string, actor: { userId: string; role: string; propertyId: string }, reason: string) {
    const stage = reimbursementStageForRole(actor.role);
    if (!stage || !reason.trim()) throw new Error('A rejection reason is required.');
    return prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.findFirst({ where: { id, propertyId: actor.propertyId } });
      if (!claim || claim.status !== stage) throw new Error('This claim is not awaiting your review stage.');
      return tx.expenseClaim.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason.trim(), ...(stage === 'HR_REVIEW' ? { hrReviewedBy: actor.userId, hrReviewedAt: new Date() } : {}), ...(stage === 'ACCOUNTANT_REVIEW' ? { accountantReviewedBy: actor.userId, accountantReviewedAt: new Date() } : {}), ...(stage === 'GENERAL_MANAGER_REVIEW' ? { managerApprovedBy: actor.userId, managerApprovedAt: new Date() } : {}) } });
    });
  }

  static async pay(ctx: TenantContext, id: string, input: { method: 'CASH' | 'BANK_TRANSFER'; bankAccountId?: string; paymentReference?: string }) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.findFirst({ where: { id, propertyId: { in: [...ctx.propertyIds] } } });
      if (!claim || claim.status !== 'APPROVED_FOR_PAYMENT') throw new Error('Only claims approved by HR, Accounting, and the General Manager can be paid.');
      if (input.method === 'BANK_TRANSFER' && !input.paymentReference?.trim()) throw new Error('A bank transfer reference is required.');

      const controls = await ensureCashierControlAccountsForClient(ctx, tx, claim.propertyId);
      const safe = controls.find((account: any) => account.type === 'SAFE');
      const source = input.method === 'CASH'
        ? safe
        : await tx.cashAccount.findFirst({ where: { id: input.bankAccountId, propertyId: claim.propertyId, type: 'BANK_ACCOUNT', isActive: true } });
      if (!source) throw new Error('The selected payment account is unavailable.');
      if (!source.glAccountId) throw new Error(`Payment account ${source.name} is not mapped to a GL account.`);
      const amount = Number(claim.amount);
      if (Number(source.balance) < amount) throw new Error(`Insufficient balance in ${source.name}.`);

      const category = await tx.expenseCategory.findFirst({ where: { propertyId: claim.propertyId, isActive: true, OR: [{ name: claim.category }, { code: claim.category }] } });
      if (!category) throw new Error(`Configure an expense category and debit GL account for ${claim.category} before payment.`);
      const expenseAccount = await tx.chartOfAccount.findFirst({ where: { propertyId: claim.propertyId, code: category.debitAccount, type: 'EXPENSE', isActive: true } });
      if (!expenseAccount) throw new Error(`Expense category ${category.name} is mapped to missing GL account ${category.debitAccount}.`);

      const clearing = await ensureExpenseCounterpartyForClient(ctx, tx, claim.propertyId);
      await tx.cashAccount.update({ where: { id: source.id }, data: { balance: { decrement: amount } } });
      await tx.cashAccount.update({ where: { id: clearing.id }, data: { balance: { increment: amount } } });
      const journal = await GeneralLedgerService.postJournal(ctx, { propertyId: claim.propertyId, entryDate: new Date(), description: `Employee reimbursement: ${claim.claimNumber}`, reference: claim.claimNumber, sourceModule: 'AUTO_EXPENSE', lines: [
        { accountId: expenseAccount.id, debit: amount, credit: 0, description: claim.description, sourceType: 'CASH_EXPENSE', sourceId: claim.id },
        { accountId: source.glAccountId, debit: 0, credit: amount, description: `${input.method} employee reimbursement`, sourceType: 'CASH_EXPENSE', sourceId: claim.id },
      ] }, tx);
      await tx.posCashMovement.create({ data: { propertyId: claim.propertyId, deviceId: 'web-employee-reimbursements', userId: ctx.userId, amount, type: 'CASH_TRANSFER_OUT', sourceAccountId: source.id, destinationAccountId: clearing.id, reasonCode: 'EMPLOYEE_REIMBURSEMENT', receiptReference: claim.claimNumber, operationId: `employee-reimbursement-${claim.id}` } });
      return tx.expenseClaim.update({ where: { id }, data: { status: 'REIMBURSED', paidBy: ctx.userId, paidAt: new Date(), paymentMethod: input.method, paymentReference: input.paymentReference?.trim() || null, paymentAccountId: source.id, accountingJournalEntryId: journal.id } });
    });
  }
}
