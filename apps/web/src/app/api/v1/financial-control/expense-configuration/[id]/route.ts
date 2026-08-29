import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getUserPropertyIds } from '@/lib/property-access';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = String((session.user as any).role || '').toUpperCase();
  if (!['ACCOUNTANT', 'SUPER_ADMIN'].includes(role)) return NextResponse.json({ error: 'Only an accountant or super admin can configure expenses' }, { status: 403 });
  const propertyIds = await getUserPropertyIds(session.user.id);
  const { id } = await params;
  const body = await request.json();
  const isActive = Boolean(body.isActive);
  const [category, costCenter] = await Promise.all([
    prisma.expenseCategory.findFirst({ where: { id, propertyId: { in: propertyIds } } }),
    prisma.costCenter.findFirst({ where: { id, propertyId: { in: propertyIds } } }),
  ]);
  if (category) return NextResponse.json({ data: await prisma.expenseCategory.update({ where: { id }, data: { isActive } }) });
  if (costCenter) return NextResponse.json({ data: await prisma.costCenter.update({ where: { id }, data: { isActive } }) });
  return NextResponse.json({ error: 'Configuration item not found' }, { status: 404 });
}
