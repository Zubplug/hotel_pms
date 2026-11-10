import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { CashExpenseService } from '@/lib/services/cash-expense-service';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!user.isSuperAdmin && user.role !== 'GENERAL_CASHIER') return errorResponse('FORBIDDEN', 'Cashier access required', 403);
    const ctx = await requireOrganizationContext(user.id);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (String(body.action || '').toLowerCase() !== 'pay') return errorResponse('BAD_REQUEST', 'Action must be pay', 400);
    const expense = await import('@hotel-pms/db').then(({ default: db }) => db.cashExpense.findUnique({ where: { id }, select: { propertyId: true } }));
    if (!expense || !ctx.propertyIds.includes(expense.propertyId)) return errorResponse('NOT_FOUND', 'Expense not found', 404);
    if (await isNightAuditTransactionLocked(expense.propertyId)) return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Expense payment cannot be processed while Night Audit is posting.', 409);
    const result = await CashExpenseService.pay(ctx, id, { method: body.method, bankAccountId: body.bankAccountId, paymentReference: body.paymentReference });
    return successResponse({ expense: result });
  } catch (error: any) {
    console.error('[Mobile cashier expense action]', error);
    return errorResponse(error?.code || 'INTERNAL_ERROR', error?.message || 'Unable to release expense', error?.status || 500);
  }
}
