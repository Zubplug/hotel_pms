import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getUserPropertyIds } from '@/lib/property-access';
import { ensureBankAccountForClient } from '@/lib/services/cash-account-service';

const ADMIN_ROLES = ['CEO', 'SUPER_ADMIN', 'MANAGER'];

async function adminContext() {
  const actor = await auth();
  if (!actor?.user) return null;
  const role = String((actor.user as any).role || '').toUpperCase();
  return { actor, role, propertyIds: await getUserPropertyIds(actor.user.id) };
}

export async function GET(request: Request) {
  const actor = await auth();
  if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const propertyId = new URL(request.url).searchParams.get('propertyId');
  if (!propertyId || !(await getUserPropertyIds(actor.user.id)).includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const existing = await prisma.cashAccount.findMany({ where: { propertyId, type: 'BANK_ACCOUNT', isActive: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: { id: true, name: true, bankName: true, accountNumber: true, isDefault: true, balance: true } });
  const accounts = existing.length > 0 ? existing : [await ensureBankAccountForClient(prisma, propertyId)];
  return NextResponse.json({ data: accounts.map(account => ({ ...account, balance: Number(account.balance) })) });
}

export async function POST(request: Request) {
  try {
    const context = await adminContext();
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ADMIN_ROLES.includes(context.role)) return NextResponse.json({ error: 'Only property administrators can configure bank accounts' }, { status: 403 });
    const body = await request.json();
    const { propertyId, name, bankName, accountNumber, isDefault = false } = body;
    if (!propertyId || !context.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Invalid property' }, { status: 403 });
    if (!String(name || '').trim() || !String(bankName || '').trim() || !String(accountNumber || '').trim()) return NextResponse.json({ error: 'Account name, bank name, and account number are required' }, { status: 400 });
    const account = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.cashAccount.updateMany({ where: { propertyId, type: 'BANK_ACCOUNT' }, data: { isDefault: false } });
      return tx.cashAccount.create({ data: { propertyId, name: String(name).trim(), type: 'BANK_ACCOUNT', bankName: String(bankName).trim(), accountNumber: String(accountNumber).trim(), isDefault: Boolean(isDefault), balance: 0, isActive: true } });
    });
    return NextResponse.json({ data: { ...account, balance: Number(account.balance) } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to create bank account' }, { status: 500 });
  }
}
