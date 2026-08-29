import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getUserPropertyIds } from '@/lib/property-access';

const ADMIN_ROLES = ['CEO', 'SUPER_ADMIN', 'MANAGER'];

export async function PATCH(request: NextRequest, context: { params: Promise<{ accountId: string }> }) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = String((actor.user as any).role || '').toUpperCase();
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: 'Only property administrators can configure bank accounts' }, { status: 403 });
    const { accountId } = await context.params;
    const account = await prisma.cashAccount.findUnique({ where: { id: accountId } });
    if (!account || account.type !== 'BANK_ACCOUNT' || !(await getUserPropertyIds(actor.user.id)).includes(account.propertyId)) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    const body = await request.json();
    const data: Record<string, unknown> = {};
    for (const field of ['name', 'bankName', 'accountNumber']) if (body[field] !== undefined) data[field] = String(body[field]).trim();
    if (body.isDefault === true) {
      await prisma.$transaction(async (tx) => {
        await tx.cashAccount.updateMany({ where: { propertyId: account.propertyId, type: 'BANK_ACCOUNT' }, data: { isDefault: false } });
        await tx.cashAccount.update({ where: { id: accountId }, data: { ...data, isDefault: true } });
      });
    } else {
      if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
      await prisma.cashAccount.update({ where: { id: accountId }, data });
    }
    return NextResponse.json({ data: await prisma.cashAccount.findUnique({ where: { id: accountId } }) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to update bank account' }, { status: 500 });
  }
}
