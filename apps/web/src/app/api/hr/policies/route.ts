import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const staff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId, isActive: true }, select: { id: true } });
    const policies = await prisma.companyPolicy.findMany({ where: { organizationId: context.organizationId, isActive: true }, include: { acknowledgements: staff ? { where: { staffId: staff.id }, select: { acknowledgedAt: true } } : false }, orderBy: [{ effectiveDate: 'desc' }, { title: 'asc' }] });
    return NextResponse.json({ policies: policies.map((policy) => ({ ...policy, acknowledgedAt: policy.acknowledgements[0]?.acknowledgedAt || null, acknowledgements: undefined })) });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to retrieve policies' }, { status: error.message?.includes('Forbidden') ? 403 : 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    if (body.action === 'ACKNOWLEDGE') {
      const staff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId, isActive: true }, select: { id: true } });
      if (!staff) return NextResponse.json({ error: 'Linked employee record not found' }, { status: 404 });
      const policy = await prisma.companyPolicy.findFirst({ where: { id: body.policyId, organizationId: context.organizationId, isActive: true }, select: { id: true } });
      if (!policy) return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
      const acknowledgement = await prisma.policyAcknowledgement.upsert({ where: { policyId_staffId: { policyId: policy.id, staffId: staff.id } }, update: { acknowledgedAt: new Date(), ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null, userAgent: req.headers.get('user-agent') || null }, create: { policyId: policy.id, staffId: staff.id, ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null, userAgent: req.headers.get('user-agent') || null } });
      return NextResponse.json({ success: true, acknowledgement });
    }
    HrAuthorizationService.assertPermission(context, 'hr.policy.manage');
    if (!body.title?.trim() || !body.fileUrl?.trim() || !body.category || !body.effectiveDate) return NextResponse.json({ error: 'Title, category, file URL, and effective date are required' }, { status: 400 });
    const policy = await prisma.companyPolicy.create({ data: { organizationId: context.organizationId, title: body.title.trim(), version: String(body.version || '1.0'), category: String(body.category), fileUrl: body.fileUrl.trim(), effectiveDate: new Date(body.effectiveDate), requiresAcknowledgement: body.requiresAcknowledgement !== false } });
    return NextResponse.json({ success: true, policy }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Policy operation failed' }, { status: error.message?.includes('Forbidden') ? 403 : 500 }); }
}
