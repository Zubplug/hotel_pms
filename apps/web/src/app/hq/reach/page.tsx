import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import ReachControlCenter from './ReachControlCenter';

const decimal = (value: unknown) => Number(value || 0);

export default async function HQReachPage() {
  await requireHQAdmin();

  const programs = await prisma.referralProgram.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      property: { select: { name: true, organization: { select: { id: true, name: true } } } },
      _count: { select: { campaigns: true, bookings: true, commissions: true, platformFees: true } },
      activationPayments: { select: { status: true, amount: true, currency: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const organizationIds = new Set(programs.map((program) => program.property.organization.id));
  const data = {
    generatedAt: new Date().toISOString(),
    programs: programs.map((program) => ({
      id: program.id,
      propertyName: program.property.name,
      organizationName: program.property.organization.name,
      enabled: program.enabled,
      activationPaymentStatus: program.activationPaymentStatus,
      platformFeeBps: program.platformFeeBps,
      platformFeeCap: program.platformFeeCap == null ? null : decimal(program.platformFeeCap),
      minimumPayout: decimal(program.minimumPayout),
      debtSuspensionThreshold: decimal(program.debtSuspensionThreshold),
      attributionWindowDays: program.attributionWindowDays,
      activationFeeAmount: decimal(program.activationFeeAmount),
      walletAutoApply: program.walletAutoApply,
      campaignCount: program._count.campaigns,
      bookingCount: program._count.bookings,
      commissionCount: program._count.commissions,
      platformFeeCount: program._count.platformFees,
      updatedAt: program.updatedAt.toISOString(),
    })),
    metrics: {
      totalOrganizations: organizationIds.size,
      totalProperties: programs.length,
      activeProperties: programs.filter((program) => program.enabled).length,
      totalCampaigns: programs.reduce((sum, program) => sum + program._count.campaigns, 0),
      totalBookings: programs.reduce((sum, program) => sum + program._count.bookings, 0),
    },
  };

  return <ReachControlCenter data={data} />;
}
