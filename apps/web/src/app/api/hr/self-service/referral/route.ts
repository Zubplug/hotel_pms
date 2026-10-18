import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { reachShareUrl } from '@/lib/reach-links';

function employeeCode(staff: { employeeId: string | null; id: string }) {
  return staff.employeeId || `EMP-${staff.id.slice(0, 8).toUpperCase()}`;
}

async function resolveStaff(req: NextRequest) {
  const context = await HrAuthorizationService.resolveAuthContext(req);
  const staff = await prisma.staff.findFirst({
    where: { userId: context.userId, organizationId: context.organizationId, isActive: true, deletedAt: null },
    select: { id: true, organizationId: true, propertyAccess: true, employeeId: true, firstName: true, lastName: true },
  });
  if (!staff) throw new Error('No active employee record associated with current login');
  return { context, staff };
}

export async function GET(req: NextRequest) {
  try {
    const { context, staff } = await resolveStaff(req);
    const propertyId = req.nextUrl.searchParams.get('propertyId') || staff.propertyAccess[0];
    if (!propertyId || !staff.propertyAccess.includes(propertyId)) return NextResponse.json({ error: 'No authorized property selected' }, { status: 403 });

    const program = await prisma.referralProgram.findUnique({ where: { propertyId }, include: { property: { select: { name: true, bookingEngineConfig: { select: { publicSlug: true } }, bookingSite: { select: { publicSlug: true } } } } } });
    const partner = await prisma.referralPartner.findUnique({
      where: { staffId: staff.id },
      select: {
        id: true,
        isStaffReferrer: true,
        campaigns: {
          where: { propertyId },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            code: true,
            commissionBps: true,
            isActive: true,
            createdAt: true,
            clicks: { select: { id: true } },
            bookings: {
              select: {
                id: true,
                status: true,
                commission: {
                  select: {
                    amount: true,
                    status: true,
                    earnedAt: true,
                    payslipId: true,
                    payslip: { select: { payrollPeriod: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const campaign = partner?.campaigns[0] || null;
    const commissions = campaign?.bookings.flatMap((booking) => booking.commission ? [booking.commission] : []) || [];
    const paid = commissions.filter((commission) => commission.payslipId);
    const pending = commissions.filter((commission) => commission.status === 'APPROVED' && !commission.payslipId);
    return NextResponse.json({
      propertyId,
      propertyName: program?.property.name || null,
      programmeEnabled: Boolean(program?.enabled && program.staffReferralEnabled),
      isEnrolled: Boolean(partner?.isStaffReferrer && campaign),
      campaign: campaign ? { id: campaign.id, code: campaign.code, shareLink: reachShareUrl(campaign.code), commissionBps: campaign.commissionBps, isActive: campaign.isActive } : null,
      stats: {
        totalClicks: campaign?.clicks.length || 0,
        totalBookings: campaign?.bookings.length || 0,
        confirmedBookings: campaign?.bookings.filter((booking) => booking.status === 'FULFILLED').length || 0,
        totalEarned: commissions.reduce((sum, commission) => sum + Number(commission.amount), 0),
        pendingOnNextPayslip: pending.reduce((sum, commission) => sum + Number(commission.amount), 0),
        paidViaPayroll: paid.reduce((sum, commission) => sum + Number(commission.amount), 0),
      },
      recentCommissions: commissions.sort((a, b) => Number(new Date(b.earnedAt || 0)) - Number(new Date(a.earnedAt || 0))).slice(0, 30).map((commission) => ({ id: commission.id, amount: Number(commission.amount), status: commission.status, earnedAt: commission.earnedAt, payslipPeriod: commission.payslip?.payrollPeriod.name || null })),
    });
  } catch (error: any) {
    const status = /Unauthorized|Forbidden|No active/.test(error?.message || '') ? 403 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to load referral dashboard' }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { context, staff } = await resolveStaff(req);
    const body = await req.json().catch(() => ({}));
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : staff.propertyAccess[0];
    if (!propertyId || !staff.propertyAccess.includes(propertyId)) return NextResponse.json({ error: 'Property is not assigned to this employee' }, { status: 403 });
    const program = await prisma.referralProgram.findFirst({ where: { propertyId, organizationId: context.organizationId, enabled: true, staffReferralEnabled: true } });
    if (!program) return NextResponse.json({ error: 'Staff referrals are not enabled for this property' }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      let partner = await tx.referralPartner.findUnique({ where: { staffId: staff.id } });
      if (partner && partner.organizationId !== context.organizationId) throw new Error('Employee referral account belongs to another organization');
      if (!partner) {
        partner = await tx.referralPartner.create({ data: { organizationId: context.organizationId, staffId: staff.id, isStaffReferrer: true, displayName: `${staff.firstName} ${staff.lastName}`.trim(), email: null, status: 'ACTIVE', verificationStatus: 'VERIFIED' } });
      }
      const existing = await tx.referralCampaign.findFirst({ where: { partnerId: partner.id, propertyId }, orderBy: { createdAt: 'desc' } });
      if (existing) return existing;
      const code = `STAFF-${employeeCode(staff).replace(/[^A-Z0-9]/gi, '').slice(-8)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      return tx.referralCampaign.create({ data: { organizationId: context.organizationId, propertyId, programId: program.id, partnerId: partner.id, name: `Staff referral · ${staff.firstName} ${staff.lastName}`.trim(), code, category: 'STAY', targetUrl: reachShareUrl(code), commissionBps: 700 } });
    });
    return NextResponse.json({ campaign: { id: result.id, code: result.code, shareLink: reachShareUrl(result.code), commissionBps: result.commissionBps, isActive: result.isActive } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to activate staff referrals' }, { status: 400 });
  }
}
