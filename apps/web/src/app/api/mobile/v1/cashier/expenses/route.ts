import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { CashExpenseService } from '@/lib/services/cash-expense-service';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

export const dynamic = 'force-dynamic';

const CASHIER_ROLES = ['GENERAL_CASHIER', 'SUPER_ADMIN'];

function serializeExpense(expense: any) {
  return {
    id: expense.id,
    reference: expense.expenseReference,
    status: expense.status,
    amount: Number(expense.amount),
    currency: expense.currency,
    category: expense.category,
    description: expense.description,
    payee: expense.payee,
    receiptUrl: expense.receiptUrl,
    costCenter: expense.costCenter,
    currentApprovalStage: expense.currentApprovalStage,
    paymentMethod: expense.paymentMethod,
    paymentReference: expense.paymentReference,
    createdAt: expense.createdAt,
    lineItems: (expense.lineItems || []).map((item: any) => ({
      description: item.description,
      unit: item.unit,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!user.isSuperAdmin && !CASHIER_ROLES.includes(user.role)) return errorResponse('FORBIDDEN', 'Cashier access required', 403);
    const ctx = await requireOrganizationContext(user.id);
    const propertyId = req.nextUrl.searchParams.get('propertyId') || ctx.propertyIds[0];
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);

    const [expenses, categories, costCenters, bankAccounts] = await Promise.all([
      CashExpenseService.list(ctx, [propertyId]),
      prisma.expenseCategory.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      prisma.costCenter.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      prisma.cashAccount.findMany({ where: { propertyId, type: 'BANK_ACCOUNT', isActive: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: { id: true, name: true, bankName: true, accountNumber: true, balance: true } }),
    ]);
    return successResponse({ propertyId, expenses: expenses.map(serializeExpense), categories, costCenters, bankAccounts: bankAccounts.map((account) => ({ ...account, balance: Number(account.balance) })) });
  } catch (error: any) {
    console.error('[Mobile cashier expenses GET]', error);
    return errorResponse('INTERNAL_ERROR', error?.message || 'Unable to load expenses', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!user.isSuperAdmin && !CASHIER_ROLES.includes(user.role)) return errorResponse('FORBIDDEN', 'Cashier access required', 403);
    const ctx = await requireOrganizationContext(user.id);
    const body = await req.json().catch(() => ({}));
    const propertyId = String(body.propertyId || ctx.propertyIds[0] || '');
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
    if (await isNightAuditTransactionLocked(propertyId)) {
      const overrideReason = String(body.nightAuditOverrideReason || '').trim();
      if (!overrideReason) return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Night Audit is in progress. Provide an override reason to record this expense.', 409);
      body.description = `${body.description || ''} [Night Audit Override: ${overrideReason}]`.trim();
    }
    const expense = await CashExpenseService.create(ctx, {
      propertyId,
      amount: Number(body.amount),
      currency: String(body.currency || 'NGN'),
      categoryId: String(body.categoryId || ''),
      description: String(body.description || ''),
      payee: String(body.payee || ''),
      receiptUrl: body.receiptUrl,
      costCenterId: body.costCenterId ? String(body.costCenterId) : undefined,
      items: Array.isArray(body.items) ? body.items : undefined,
      role: user.role,
    });
    return successResponse({ expense: serializeExpense(expense) }, 201);
  } catch (error: any) {
    console.error('[Mobile cashier expenses POST]', error);
    return errorResponse(error?.code || 'INTERNAL_ERROR', error?.message || 'Unable to submit expense', error?.status || 500);
  }
}
