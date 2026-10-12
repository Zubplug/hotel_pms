import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

const STATUTORY_TYPES = ['PAYE', 'PENSION', 'NHF', 'NSITF', 'ITF'];
const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REMITTED', 'REJECTED'];

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.employee.view');
    const remittances = await prisma.taxRemittance.findMany({ where: { propertyId: context.propertyId, property: { organizationId: context.organizationId }, taxType: { in: STATUTORY_TYPES } }, orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }], take: 250 });
    return NextResponse.json({ remittances });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to retrieve remittances' }, { status: error.message?.includes('Forbidden') ? 403 : 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.remittance.manage');
    const body = await req.json();
    if (!STATUTORY_TYPES.includes(body.taxType) || !body.periodStart || !body.periodEnd || !body.remittanceDate) return NextResponse.json({ error: 'Tax type, period dates, and remittance date are required' }, { status: 400 });
    const collected = Number(body.collectedAmount);
    const remitted = Number(body.remittedAmount);
    if (![collected, remitted].every(Number.isFinite) || collected < 0 || remitted < 0 || remitted > collected) return NextResponse.json({ error: 'Remittance amounts must be non-negative and remitted amount cannot exceed collected amount' }, { status: 400 });
    const remittance = await prisma.taxRemittance.create({ data: { propertyId: context.propertyId, periodStart: new Date(body.periodStart), periodEnd: new Date(body.periodEnd), taxType: body.taxType, collectedAmount: collected, remittedAmount: remitted, remittanceDate: new Date(body.remittanceDate), remittanceRef: body.remittanceRef?.trim() || null, authorityName: body.authorityName?.trim() || null, attachmentUrl: body.attachmentUrl?.trim() || null, notes: body.notes?.trim() || null, status: 'DRAFT', recordedBy: context.userId } });
    return NextResponse.json({ success: true, remittance }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to create remittance' }, { status: error.message?.includes('Forbidden') ? 403 : 400 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.remittance.manage');
    const body = await req.json();
    if (!body.id || !STATUSES.includes(body.status)) return NextResponse.json({ error: 'Remittance ID and valid status are required' }, { status: 400 });
    const existing = await prisma.taxRemittance.findFirst({ where: { id: body.id, propertyId: context.propertyId, property: { organizationId: context.organizationId }, taxType: { in: STATUTORY_TYPES } } });
    if (!existing) return NextResponse.json({ error: 'Remittance not found' }, { status: 404 });
    if (existing.status === 'REMITTED') return NextResponse.json({ error: 'A remitted record is immutable' }, { status: 409 });
    const remittance = await prisma.taxRemittance.update({ where: { id: existing.id }, data: { status: body.status, approvedBy: ['APPROVED', 'REMITTED'].includes(body.status) ? context.userId : undefined, approvedAt: ['APPROVED', 'REMITTED'].includes(body.status) ? new Date() : undefined, remittanceRef: body.remittanceRef?.trim() || undefined, attachmentUrl: body.attachmentUrl?.trim() || undefined, notes: body.notes?.trim() || undefined } });
    return NextResponse.json({ success: true, remittance });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to update remittance' }, { status: error.message?.includes('Forbidden') ? 403 : 400 }); }
}
