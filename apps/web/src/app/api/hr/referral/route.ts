import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

const HR_ROLES = new Set(['HR_MANAGER', 'HR_OFFICER', 'PAYROLL_OFFICER', 'PAYROLL_APPROVER', 'FINANCIAL_CONTROLLER', 'GENERAL_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'OWNER', 'CEO']);

async function contextFor(req: NextRequest) {
  const context = await HrAuthorizationService.resolveAuthContext(req);
  if (!HR_ROLES.has(context.role) && !HrAuthorizationService.can(context, 'hr.settings.manage')) throw new Error('Forbidden: HR authorization required');
  if (!context.propertyId) throw new Error('Forbidden: Property context is required');
  return context;
}

export async function GET(req: NextRequest) {
  try {
    const context = await contextFor(req);
    const program = await prisma.referralProgram.findFirst({ where: { organizationId: context.organizationId, propertyId: context.propertyId }, select: { enabled: true, staffReferralEnabled: true, attributionWindowDays: true, property: { select: { baseCurrency: true } } } });
    const commissions = await prisma.referralCommission.findMany({ where: { organizationId: context.organizationId, propertyId: context.propertyId, partner: { isStaffReferrer: true }, }, include: { partner: { include: { staff: { select: { id: true, firstName: true, lastName: true, employeeId: true } } } }, referralBooking: { select: { status: true } }, payslip: { select: { payrollPeriod: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: 500 });
    const campaigns = await prisma.referralCampaign.findMany({ where: { organizationId: context.organizationId, propertyId: context.propertyId, partner: { isStaffReferrer: true } }, include: { partner: { include: { staff: { select: { id: true, firstName: true, lastName: true, employeeId: true } } } }, _count: { select: { clicks: true, bookings: true } } }, orderBy: { createdAt: 'desc' } });
    const pending = commissions.filter((commission) => commission.status === 'APPROVED' && !commission.payslipId);
    const now = new Date();
    const paidThisMonth = commissions.filter((commission) => commission.payslipId && commission.paidAt && commission.paidAt.getUTCFullYear() === now.getUTCFullYear() && commission.paidAt.getUTCMonth() === now.getUTCMonth());
    const totalAllTime = commissions.reduce((sum, commission) => sum + Number(commission.amount), 0);
    return NextResponse.json({ programme: { staffReferralEnabled: Boolean(program?.staffReferralEnabled), programmeEnabled: Boolean(program?.enabled), commissionBps: campaigns[0]?.commissionBps || 700, attributionWindowDays: program?.attributionWindowDays || 30, currency: program?.property.baseCurrency || 'NGN' }, summary: { activeReferrers: campaigns.filter((campaign) => campaign.isActive).length, pendingNextPayroll: { count: pending.length, amount: pending.reduce((sum, commission) => sum + Number(commission.amount), 0) }, paidThisMonth: { count: paidThisMonth.length, amount: paidThisMonth.reduce((sum, commission) => sum + Number(commission.amount), 0) }, totalAllTime }, staffReferrers: campaigns.map((campaign) => ({ id: campaign.id, campaignId: campaign.id, staffId: campaign.partner.staff?.id, name: campaign.partner.staff ? `${campaign.partner.staff.firstName} ${campaign.partner.staff.lastName}`.trim() : campaign.partner.displayName, employeeId: campaign.partner.staff?.employeeId, code: campaign.code, isActive: campaign.isActive, clicks: campaign._count.clicks, bookings: campaign._count.bookings, pending: commissions.filter((commission) => commission.partnerId === campaign.partnerId && commission.status === 'APPROVED' && !commission.payslipId).reduce((sum, commission) => sum + Number(commission.amount), 0), earned: commissions.filter((commission) => commission.partnerId === campaign.partnerId).reduce((sum, commission) => sum + Number(commission.amount), 0) })), pendingCommissions: pending.map((commission) => ({ id: commission.id, staffName: commission.partner.staff ? `${commission.partner.staff.firstName} ${commission.partner.staff.lastName}`.trim() : commission.partner.displayName, amount: Number(commission.amount), currency: commission.currency, earnedAt: commission.earnedAt, bookingStatus: commission.referralBooking.status })), recentlyPaid: commissions.filter((commission) => commission.payslipId).slice(0, 100).map((commission) => ({ id: commission.id, staffName: commission.partner.staff ? `${commission.partner.staff.firstName} ${commission.partner.staff.lastName}`.trim() : commission.partner.displayName, amount: Number(commission.amount), currency: commission.currency, payslipPeriod: commission.payslip?.payrollPeriod.name || null, paidAt: commission.paidAt })) });
  } catch (error: any) {
    const status = /Unauthorized|Forbidden/.test(error?.message || '') ? 403 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to load staff referral controls' }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await contextFor(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').toUpperCase();
    const result = await prisma.$transaction(async (tx) => {
      if (action === 'TOGGLE_PROGRAMME') {
        const current = await tx.referralProgram.findFirst({ where: { organizationId: context.organizationId, propertyId: context.propertyId } });
        if (!current) throw new Error('Referral programme is not configured for this property');
        const updated = await tx.referralProgram.update({ where: { id: current.id }, data: { staffReferralEnabled: !current.staffReferralEnabled } });
        await tx.auditLog.create({ data: { organizationId: context.organizationId, propertyId: context.propertyId, userId: context.userId, action: 'STAFF_REFERRAL_PROGRAM_TOGGLED', resource: 'ReferralProgram', resourceId: current.id, requestId: randomUUID(), previousValue: { staffReferralEnabled: current.staffReferralEnabled }, newValue: { staffReferralEnabled: updated.staffReferralEnabled } } });
        return { staffReferralEnabled: updated.staffReferralEnabled };
      }
      if (action === 'TOGGLE_STAFF_CAMPAIGN') {
        const campaign = await tx.referralCampaign.findFirst({ where: { id: String(body?.campaignId || ''), organizationId: context.organizationId, propertyId: context.propertyId, partner: { isStaffReferrer: true } } });
        if (!campaign) throw new Error('Staff campaign not found');
        const updated = await tx.referralCampaign.update({ where: { id: campaign.id }, data: { isActive: body?.isActive === true } });
        return { campaignId: updated.id, isActive: updated.isActive };
      }
      if (action === 'VOID_COMMISSION') {
        const commission = await tx.referralCommission.findFirst({ where: { id: String(body?.commissionId || ''), organizationId: context.organizationId, propertyId: context.propertyId, partner: { isStaffReferrer: true }, payslipId: null, status: 'APPROVED' } });
        if (!commission) throw new Error('Only pending staff commissions can be voided');
        const reason = String(body?.reason || '').trim();
        if (reason.length < 3) throw new Error('A reason is required to void a commission');
        const updated = await tx.referralCommission.update({ where: { id: commission.id }, data: { status: 'REVERSED', updatedAt: new Date() } });
        await tx.referralLedgerEntry.create({ data: { organizationId: commission.organizationId, partnerId: commission.partnerId, commissionId: commission.id, entryType: 'ADJUSTMENT', amount: -commission.amount, currency: commission.currency, idempotencyKey: `STAFF_REFERRAL_VOID:${commission.id}`, metadata: { source: 'HR_VOID', reason } } });
        await tx.auditLog.create({ data: { organizationId: context.organizationId, propertyId: context.propertyId, userId: context.userId, action: 'STAFF_REFERRAL_COMMISSION_VOIDED', resource: 'ReferralCommission', resourceId: commission.id, requestId: randomUUID(), previousValue: { status: commission.status, amount: commission.amount }, newValue: { status: updated.status, reason: String(body?.reason || '').trim() || 'HR voided commission' } } });
        return { commissionId: updated.id, status: updated.status };
      }
      throw new Error('Unsupported HR referral action');
    });
    return NextResponse.json(result);
  } catch (error: any) {
    const status = /Forbidden|authorization/.test(error?.message || '') ? 403 : 400;
    return NextResponse.json({ error: error?.message || 'Unable to update staff referral controls' }, { status });
  }
}
