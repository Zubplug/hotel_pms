import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getUserPropertyIds } from '@/lib/property-access';
import { CashExpenseService } from '@/lib/services/cash-expense-service';

const GENERAL_CASHIER = ['GENERAL_CASHIER', 'SUPER_ADMIN'];

async function actorContext() {
  const session = await auth();
  if (!session?.user) return null;
  const role = String((session.user as any).role || '').toUpperCase();
  const propertyIds = await getUserPropertyIds(session.user.id);
  const staff = await prisma.staff.findFirst({ where: { OR: [{ userId: session.user.id }, ...((session.user as any).staffId ? [{ id: (session.user as any).staffId }] : [])], isActive: true }, select: { id: true } });
  return { session, role, propertyIds, staffId: staff?.id };
}

export async function GET() {
  try {
    const actor = await actorContext();
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!GENERAL_CASHIER.includes(actor.role) && !['MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT', 'CEO'].includes(actor.role)) return NextResponse.json({ error: 'Expense access denied' }, { status: 403 });
    return NextResponse.json({ data: await CashExpenseService.list(actor.propertyIds) });
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
    const expense = await CashExpenseService.create({ propertyId: body.propertyId, requestedBy: actor.staffId, amount: Number(body.amount), currency: body.currency, category: String(body.category || ''), description: String(body.description || ''), payee: String(body.payee || ''), receiptUrl: body.receiptUrl, costCenter: body.costCenter });
    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to create expense' }, { status: error.status || 500 });
  }
}
