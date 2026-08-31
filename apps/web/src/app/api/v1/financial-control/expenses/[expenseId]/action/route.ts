import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { CashExpenseService } from '@/lib/services/cash-expense-service';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
const APPROVERS = ['MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN'];
export async function POST(request: NextRequest, context: { params: Promise<{ expenseId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = String((session.user as any).role || '').toUpperCase();
    const staff = await prisma.staff.findFirst({ where: { OR: [{ userId: session.user.id }, ...((session.user as any).staffId ? [{ id: (session.user as any).staffId }] : [])], isActive: true }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'Staff record not found' }, { status: 401 });
    const { expenseId } = await context.params;
    const expense = await prisma.cashExpense.findUnique({ where: { id: expenseId }, select: { propertyId: true } });
    if (!expense || !((await requireOrganizationContext(session.user.id)).propertyIds).includes(expense.propertyId)) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    const body = await request.json();
    const action = String(body.action || '').toLowerCase();
    if (action === 'pay') {
      if (!['GENERAL_CASHIER', 'SUPER_ADMIN'].includes(role)) return NextResponse.json({ error: 'Only the General Cashier can pay expenses' }, { status: 403 });
      if (await isNightAuditTransactionLocked(expense.propertyId)) {
        return NextResponse.json({ error: 'Expense payment cannot be processed while Night Audit is posting.', code: 'NIGHT_AUDIT_IN_PROGRESS' }, { status: 409 });
      }
      return NextResponse.json({ data: await CashExpenseService.pay(await requireOrganizationContext(session.user.id), expenseId) });
    }
    if (!APPROVERS.includes(role)) return NextResponse.json({ error: 'Expense approval access denied' }, { status: 403 });
    if (action === 'approve') return NextResponse.json({ data: await CashExpenseService.approve(await requireOrganizationContext(session.user.id), expenseId, body.notes) });
    if (action === 'reject') return NextResponse.json({ data: await CashExpenseService.reject(await requireOrganizationContext(session.user.id), expenseId, String(body.reason || '')) });
    return NextResponse.json({ error: 'Action must be approve, reject, or pay' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to update expense' }, { status: error.status || 500 });
  }
}
