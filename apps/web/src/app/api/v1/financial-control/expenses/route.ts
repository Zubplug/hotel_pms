import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { CashExpenseService } from '@/lib/services/cash-expense-service';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
const GENERAL_CASHIER = ['GENERAL_CASHIER', 'SUPER_ADMIN'];
async function actorContext() {
  const session = await auth();
  if (!session?.user) return null;
  const role = String((session.user as any).role || '').toUpperCase();
  const ctx = await requireOrganizationContext(session.user.id);
  const propertyIds = ctx.propertyIds;
  const staff = await prisma.staff.findFirst({ where: { OR: [{ userId: session.user.id }, ...((session.user as any).staffId ? [{ id: (session.user as any).staffId }] : [])], isActive: true }, select: { id: true } });
  return { session, role, propertyIds, staffId: staff?.id, ctx };
}
export async function GET() {
  try {
    const actor = await actorContext();
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!GENERAL_CASHIER.includes(actor.role) && !['MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT', 'CEO'].includes(actor.role)) return NextResponse.json({ error: 'Expense access denied' }, { status: 403 });
    return NextResponse.json({ data: await CashExpenseService.list(actor.ctx, actor.propertyIds as string[]) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to load expenses' }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await actorContext();
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!GENERAL_CASHIER.includes(actor.role)) return NextResponse.json({ error: 'Only the General Cashier can create expenses' }, { status: 403 });
    if (!actor.staffId) return NextResponse.json({ error: 'Staff record not found' }, { status: 401 });
    const body = await request.json();
    if (!body.propertyId || !actor.propertyIds.includes(body.propertyId)) return NextResponse.json({ error: 'Invalid property' }, { status: 403 });
    // OVERRIDE-pattern night audit guard.
    // A General Cashier may record an urgent expense during Night Audit cutover
    // only with an explicit reason. The reason is written to the expense record.
    const OVERRIDE_ROLES = new Set(['SUPER_ADMIN', 'MANAGER', 'HOTEL_MANAGER', 'GENERAL_CASHIER']);
    if (await isNightAuditTransactionLocked(body.propertyId)) {
      const overrideReason = String(body.nightAuditOverrideReason || '').trim();
      if (!overrideReason || !OVERRIDE_ROLES.has(actor.role)) {
        return NextResponse.json({
          error: 'Night Audit is in progress. To record a cash expense now, supply a nightAuditOverrideReason in the request body.',
          code: 'NIGHT_AUDIT_IN_PROGRESS'
        }, { status: 409 });
      }
      // Override reason is appended to the expense description for auditability
      body.description = `${body.description || ''} [Night Audit Override: ${overrideReason}]`.trim();
    }
    const expense = await CashExpenseService.create(actor.ctx, { propertyId: body.propertyId, amount: Number(body.amount), currency: body.currency, categoryId: String(body.categoryId || ''), description: String(body.description || ''), payee: String(body.payee || ''), receiptUrl: body.receiptUrl, costCenterId: body.costCenterId ? String(body.costCenterId) : undefined });
    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to create expense' }, { status: error.status || 500 });
  }
}
