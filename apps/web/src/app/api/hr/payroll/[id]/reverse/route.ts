import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { requireOrganizationContext } from '@/lib/organization-access';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.payroll.reverse');
    if (!context.propertyId) return NextResponse.json({ error: 'Property context is required' }, { status: 400 });
    const { id } = await params;
    const body = await req.json();
    if (!body.reason?.trim() || body.reason.trim().length < 10) return NextResponse.json({ error: 'A detailed reversal reason is required' }, { status: 400 });
    const period = await prisma.payrollPeriod.findFirst({ where: { id, organizationId: context.organizationId, propertyId: context.propertyId } });
    if (!period) return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    if (!['APPROVED', 'PAID'].includes(period.status)) return NextResponse.json({ error: 'Only approved or paid payroll periods can be reversed' }, { status: 409 });
    if (!period.journalEntryId) return NextResponse.json({ error: 'Payroll period has no posted journal to reverse' }, { status: 409 });
    const ledgerContext = await requireOrganizationContext(context.userId);
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.payrollPeriod.findFirst({ where: { id: period.id, status: { in: ['APPROVED', 'PAID'] }, journalEntryId: period.journalEntryId } });
      if (!current) throw new Error('Payroll period was already changed or reversed');
      const reversal = await GeneralLedgerService.reverseJournal(ledgerContext, period.journalEntryId!, body.reversalDate ? new Date(body.reversalDate) : new Date(), body.reason.trim(), tx);
      const existingTrail = Array.isArray(current.approvalTrail) ? current.approvalTrail : [];
      const updated = await tx.payrollPeriod.update({ where: { id: current.id }, data: { status: 'CANCELLED', paymentStatus: 'FAILED', reversalReason: body.reason.trim(), approvalTrail: [...existingTrail, { action: 'REVERSED', userId: context.userId, at: new Date().toISOString(), reversalEntryId: reversal.id, reason: body.reason.trim() }] } });
      await tx.auditLog.create({ data: { organizationId: context.organizationId, propertyId: context.propertyId, userId: context.userId, action: 'PAYROLL_PERIOD_REVERSED', resource: 'PayrollPeriod', resourceId: current.id, requestId: randomUUID(), newValue: { originalJournalEntryId: period.journalEntryId, reversalEntryId: reversal.id, reason: body.reason.trim() } } });
      return { updated, reversal };
    });
    return NextResponse.json({ success: true, period: result.updated, reversalJournalEntryId: result.reversal.id });
  } catch (error: any) {
    const message = error?.message || 'Failed to reverse payroll';
    return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 400 });
  }
}
