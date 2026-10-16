import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import ReachControlCenter from './ReachControlCenter';

const decimal = (value: unknown) => Number(value || 0);

export default async function HQReachPage() {
  await requireHQAdmin();

  const [partners, programs, bookings, commissions, payouts, platformFees] = await Promise.all([
    prisma.referralPartner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { campaigns: true, bookings: true, commissions: true } },
        commissions: { select: { amount: true, status: true } },
      },
    }),
    prisma.referralProgram.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        property: { select: { name: true, organization: { select: { name: true } } } },
        _count: { select: { campaigns: true, bookings: true, commissions: true, platformFees: true } },
        activationPayments: { select: { status: true, amount: true, currency: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.referralBooking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        partner: { select: { displayName: true, businessName: true } },
        property: { select: { name: true } },
        commission: { select: { amount: true, status: true, currency: true } },
        platformFee: { select: { amount: true, status: true, currency: true } },
      },
    }),
    prisma.referralCommission.aggregate({ _sum: { amount: true, reversedAmount: true }, _count: true }),
    prisma.referralPayout.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.referralPlatformFee.aggregate({ _sum: { amount: true, outstandingAmount: true, reversedAmount: true }, _count: true }),
  ]);

  const data = {
    generatedAt: new Date().toISOString(),
    partners: partners.map((partner) => ({
      id: partner.id,
      displayName: partner.displayName,
      firstName: partner.firstName,
      middleName: partner.middleName,
      lastName: partner.lastName,
      businessName: partner.businessName,
      email: partner.email,
      phone: partner.phone,
      status: partner.status,
      verificationStatus: partner.verificationStatus,
      createdAt: partner.createdAt.toISOString(),
      campaignCount: partner._count.campaigns,
      bookingCount: partner._count.bookings,
      commissionCount: partner._count.commissions,
      commissionTotal: partner.commissions.reduce((sum, item) => sum + decimal(item.amount), 0),
    })),
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
    bookings: bookings.map((booking) => ({
      id: booking.id,
      propertyName: booking.property.name,
      partnerName: booking.partner.businessName || booking.partner.displayName,
      status: booking.status,
      category: booking.category,
      eligibleRevenue: decimal(booking.eligibleRevenue),
      currency: booking.currency,
      commissionAmount: booking.commission ? decimal(booking.commission.amount) : 0,
      commissionStatus: booking.commission?.status || '—',
      platformFeeAmount: booking.platformFee ? decimal(booking.platformFee.amount) : 0,
      createdAt: booking.createdAt.toISOString(),
    })),
    metrics: {
      totalPartners: partners.length,
      pendingPartners: partners.filter((partner) => partner.verificationStatus === 'PENDING').length,
      verifiedPartners: partners.filter((partner) => partner.verificationStatus === 'VERIFIED').length,
      activePrograms: programs.filter((program) => program.enabled).length,
      totalPrograms: programs.length,
      bookingCount: bookings.length,
      commissionCount: commissions._count,
      commissionTotal: decimal(commissions._sum.amount),
      payoutTotal: decimal(payouts._sum.amount),
      platformFeeTotal: decimal(platformFees._sum.amount),
      outstandingPlatformFees: decimal(platformFees._sum.outstandingAmount),
    },
  };

  return <ReachControlCenter data={data} />;
}
