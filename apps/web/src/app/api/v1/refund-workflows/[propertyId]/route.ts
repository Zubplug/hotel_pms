import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

async function authorize(req: NextRequest, propertyId: string) {
  const user = await resolveUser(req);
  if (!user) throw new Error('UNAUTHORIZED');
  if (!ADMIN_ROLES.includes(user.role) && !user.isSuperAdmin) throw new Error('FORBIDDEN');
  if (!user.allowedProperties.includes(propertyId)) throw new Error('FORBIDDEN');
  return user;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  try {
    const { propertyId } = await params;
    await authorize(req, propertyId);
    const rules = await prisma.refundApprovalRule.findMany({ where: { propertyId, isActive: true }, include: { role: true, approver: { select: { id: true, email: true } } }, orderBy: { stepOrder: 'asc' } });
    return NextResponse.json({ data: rules });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    console.error('[Refund Workflow GET]', error);
    return NextResponse.json({ error: 'Unable to load refund workflow' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  try {
    const { propertyId } = await params;
    const user = await authorize(req, propertyId);
    const body = await req.json();
    if (!Array.isArray(body.rules) || body.rules.length > 10) return NextResponse.json({ error: 'Provide between zero and ten workflow steps' }, { status: 400 });
    const rules: Array<{ stepOrder: number; minAmount: number | null; maxAmount: number | null; roleId: string | null; approverId: string | null }> = body.rules.map((rule: { stepOrder?: number; minAmount?: number | string | null; maxAmount?: number | string | null; roleId?: string | null; approverId?: string | null }, index: number) => ({
      stepOrder: Number(rule.stepOrder || index + 1),
      minAmount: rule.minAmount == null || rule.minAmount === '' ? null : Number(rule.minAmount),
      maxAmount: rule.maxAmount == null || rule.maxAmount === '' ? null : Number(rule.maxAmount),
      roleId: rule.roleId || null,
      approverId: rule.approverId || null,
    }));
    const steps = new Set(rules.map(rule => rule.stepOrder));
    if (steps.size !== rules.length || rules.some(rule => !Number.isInteger(rule.stepOrder) || rule.stepOrder < 1 || (rule.minAmount != null && (!Number.isFinite(rule.minAmount) || rule.minAmount < 0)) || (rule.maxAmount != null && (!Number.isFinite(rule.maxAmount) || rule.maxAmount < 0)) || (rule.minAmount != null && rule.maxAmount != null && rule.minAmount > rule.maxAmount))) {
      return NextResponse.json({ error: 'Invalid workflow steps or amount ranges' }, { status: 400 });
    }
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { organizationId: true } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    for (const rule of rules) {
      if (rule.roleId) {
        const role = await prisma.role.findFirst({ where: { id: rule.roleId, organizationId: property.organizationId } });
        if (!role) return NextResponse.json({ error: 'Invalid approval role' }, { status: 400 });
      }
      if (rule.approverId) {
        const member = await prisma.userRole.findFirst({ where: { userId: rule.approverId, OR: [{ propertyId }, { propertyId: null }] } });
        if (!member) return NextResponse.json({ error: 'Approver is not assigned to this property' }, { status: 400 });
      }
    }
    const saved = await prisma.$transaction(async tx => {
      await tx.refundApprovalRule.deleteMany({ where: { propertyId } });
      if (rules.length) await tx.refundApprovalRule.createMany({ data: rules.map(rule => ({ ...rule, propertyId })) });
      return tx.refundApprovalRule.findMany({ where: { propertyId }, orderBy: { stepOrder: 'asc' } });
    });
    return NextResponse.json({ data: saved, updatedBy: user.id });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    console.error('[Refund Workflow PUT]', error);
    return NextResponse.json({ error: 'Unable to save refund workflow' }, { status: 500 });
  }
}
