import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
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
    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);
    const remittanceDate = new Date(body.remittanceDate);
    if ([periodStart, periodEnd, remittanceDate].some((date) => Number.isNaN(date.getTime())) || periodStart > periodEnd) return NextResponse.json({ error: 'Remittance dates are invalid' }, { status: 400 });
    const remittance = await prisma.taxRemittance.create({ data: { propertyId: context.propertyId, periodStart, periodEnd, taxType: body.taxType, collectedAmount: collected, remittedAmount: remitted, remittanceDate, remittanceRef: body.remittanceRef?.trim() || null, authorityName: body.authorityName?.trim() || null, attachmentUrl: body.attachmentUrl?.trim() || null, notes: body.notes?.trim() || null, status: 'DRAFT', recordedBy: context.userId } });
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
    const allowed: Record<string, string[]> = { DRAFT: ['SUBMITTED'], SUBMITTED: ['APPROVED', 'REJECTED'], APPROVED: ['REMITTED'], REJECTED: [] };
    if (!allowed[existing.status]?.includes(body.status)) return NextResponse.json({ error: `Cannot move a ${existing.status} remittance to ${body.status}` }, { status: 409 });
    if (body.status === 'APPROVED' && existing.recordedBy === context.userId) return NextResponse.json({ error: 'The preparer cannot approve their own remittance' }, { status: 403 });
    if (body.status === 'REJECTED' && !body.rejectionReason?.trim()) return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 });
    if (body.status === 'REMITTED' && !((body.remittanceRef || existing.remittanceRef)?.trim() && (body.attachmentUrl || existing.attachmentUrl)?.trim())) return NextResponse.json({ error: 'Remittance reference and evidence attachment are required before marking remitted' }, { status: 400 });
    const now = new Date();
    const remittance = await prisma.$transaction(async (tx) => {
      const updated = await tx.taxRemittance.update({ where: { id: existing.id }, data: { status: body.status, submittedBy: body.status === 'SUBMITTED' ? context.userId : undefined, submittedAt: body.status === 'SUBMITTED' ? now : undefined, approvedBy: body.status === 'APPROVED' ? context.userId : undefined, approvedAt: body.status === 'APPROVED' ? now : undefined, remittedBy: body.status === 'REMITTED' ? context.userId : undefined, remittedAt: body.status === 'REMITTED' ? now : undefined, rejectionReason: body.status === 'REJECTED' ? body.rejectionReason.trim() : undefined, remittanceRef: body.remittanceRef?.trim() || undefined, attachmentUrl: body.attachmentUrl?.trim() || undefined, notes: body.notes?.trim() || undefined } });
      await tx.auditLog.create({ data: { organizationId: context.organizationId, propertyId: context.propertyId, userId: context.userId, action: `HR_REMITTANCE_${body.status}`, resource: 'TaxRemittance', resourceId: updated.id, previousValue: { status: existing.status }, newValue: { status: updated.status, reason: body.rejectionReason || null }, requestId: randomUUID() } });
      return updated;
    });
    return NextResponse.json({ success: true, remittance });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to update remittance' }, { status: error.message?.includes('Forbidden') ? 403 : 400 }); }
}
