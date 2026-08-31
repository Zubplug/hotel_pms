import { requireOrganizationContext } from '@/lib/organization-access';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
const CONFIG_ROLES = ['ACCOUNTANT', 'SUPER_ADMIN'];
const READ_ROLES = ['GENERAL_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'CEO', 'SUPER_ADMIN'];
async function context() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    role: String((session.user as any).role || '').toUpperCase(),
    propertyIds: (await requireOrganizationContext(session.user.id)).propertyIds,
  };
}
export async function GET(request: Request) {
  const actor = await context();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!READ_ROLES.includes(actor.role)) return NextResponse.json({ error: 'Expense configuration access denied' }, { status: 403 });
  const propertyId = new URL(request.url).searchParams.get('propertyId');
  if (!propertyId || !actor.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Invalid property' }, { status: 403 });
  const [categories, costCenters] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.costCenter.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' } }),
  ]);
  return NextResponse.json({ data: { categories, costCenters } });
}
export async function POST(request: Request) {
  const actor = await context();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CONFIG_ROLES.includes(actor.role)) return NextResponse.json({ error: 'Only an accountant or super admin can configure expenses' }, { status: 403 });
  try {
    const body = await request.json();
    const propertyId = String(body.propertyId || '');
    const type = body.type === 'COST_CENTER' ? 'COST_CENTER' : 'CATEGORY';
    const code = String(body.code || '').trim().toUpperCase();
    const name = String(body.name || '').trim();
    if (!propertyId || !actor.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Invalid property' }, { status: 403 });
    if (!code || !name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 });
    if (type === 'CATEGORY') {
      const debitAccount = String(body.debitAccount || '').trim();
      if (!debitAccount) return NextResponse.json({ error: 'Debit account is required for an expense category' }, { status: 400 });
      const item = await prisma.expenseCategory.create({ data: { propertyId, code, name, debitAccount } });
      return NextResponse.json({ data: item }, { status: 201 });
    }
    const item = await prisma.costCenter.create({ data: { propertyId, code, name } });
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.code === 'P2002' ? 'That code or name already exists for this property' : error.message || 'Unable to save configuration' }, { status: error.code === 'P2002' ? 409 : 500 });
  }
}
