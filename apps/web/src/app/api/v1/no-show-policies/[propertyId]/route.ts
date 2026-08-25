import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';

const canManage = (user: any) => user?.isSuperAdmin || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CEO', 'FINANCE_MANAGER'].includes(user?.role) || user?.capabilities?.includes('MANAGE_NO_SHOW_POLICY');

export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { propertyId } = await params;
  if (!user.isSuperAdmin && !user.allowedProperties.includes(propertyId)) return NextResponse.json({ error: 'Property access denied' }, { status: 403 });
  const policy = await prisma.noShowPolicy.findFirst({ where: { propertyId }, orderBy: { name: 'asc' } });
  return NextResponse.json({ data: policy });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  const { propertyId } = await params;
  if (!user.isSuperAdmin && !user.allowedProperties.includes(propertyId)) return NextResponse.json({ error: 'Property access denied' }, { status: 403 });
  const body = await req.json();
  const data = { name: String(body.name || 'Default No-Show Policy'), chargeType: String(body.chargeType || 'FIRST_NIGHT'), chargeValue: Number(body.chargeValue || 0), cutoffTime: String(body.cutoffTime || '02:00'), gracePeriodMinutes: Math.max(0, Number(body.gracePeriodMinutes || 0)), refundableUnusedNights: Boolean(body.refundableUnusedNights), allowReinstatement: Boolean(body.allowReinstatement), reinstatementRequiresApproval: Boolean(body.reinstatementRequiresApproval), exceptionRequiresApproval: Boolean(body.exceptionRequiresApproval) };
  const existing = await prisma.noShowPolicy.findFirst({ where: { propertyId }, orderBy: { name: 'asc' } });
  const policy = existing ? await prisma.noShowPolicy.update({ where: { id: existing.id }, data }) : await prisma.noShowPolicy.create({ data: { propertyId, ...data } });
  return NextResponse.json({ data: policy });
}
