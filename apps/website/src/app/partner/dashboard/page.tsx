import { redirect } from "next/navigation";
import prisma from "@hotel-pms/db";
import { getPartnerSession } from "@/lib/partner-auth";
import { getPartnerEligibleProperties } from "@/lib/partner-reach";
import { PartnerDashboard } from "./PartnerDashboard";
import { reachShareUrl } from "@/lib/reach-links";

const numeric = (value: unknown) => Number(value || 0);

export default async function PartnerDashboardPage() {
  const partner = await getPartnerSession();
  if (!partner) redirect("/partner/login");
  const properties = await getPartnerEligibleProperties(partner.organizationId);
  const propertyIds = properties.map((property) => property.id);
  const scope = { partnerId: partner.id, ...(propertyIds.length ? { propertyId: { in: propertyIds } } : { propertyId: "__none__" }) };
  const [campaigns, bookingCount, fulfilled, clicks, commissionGroups, wallet, paidCount, recentClicks, recentBookings] = await Promise.all([
    prisma.referralCampaign.findMany({ where: scope, include: { property: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.referralBooking.count({ where: scope }),
    prisma.referralBooking.count({ where: { ...scope, status: "FULFILLED" } }),
    prisma.referralClick.findMany({ where: scope, select: { id: true, referralToken: true } }),
    prisma.referralCommission.groupBy({ by: ["status"], where: scope, _sum: { amount: true }, _count: { _all: true } }),
    prisma.referralPartnerWallet.findUnique({ where: { partnerId: partner.id }, select: { availableBalance: true, currency: true } }),
    prisma.referralBooking.count({ where: { ...scope, commission: { is: { status: { in: ["APPROVED", "PAYABLE", "PROCESSING", "PAID"] } } } } }),
    prisma.referralClick.findMany({ where: scope, orderBy: { occurredAt: "desc" }, take: 6, include: { property: { select: { name: true } }, campaign: { select: { name: true } } } }),
    prisma.referralBooking.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 8, include: { property: { select: { name: true } }, campaign: { select: { name: true } }, commission: { select: { amount: true, status: true, currency: true } } } }),
  ]);
  const uniqueClickKeys = new Set(clicks.map((click) => click.referralToken));
  const clickCount = uniqueClickKeys.size;
  const commissions = Object.fromEntries(commissionGroups.map((group) => [group.status, { amount: numeric(group._sum.amount), count: group._count._all }]));
  const totalCommission = Object.values(commissions).reduce((sum, group) => sum + group.amount, 0);
  const data = {
    partner: { displayName: partner.displayName, firstName: partner.firstName, businessName: partner.businessName, email: partner.email || "", verificationStatus: partner.verificationStatus },
    properties: properties.map((property) => ({ id: property.id, name: property.name, city: property.city, state: property.state, country: property.country, baseCurrency: property.baseCurrency, website: property.website, bookingSlug: property.bookingEngineConfig?.publicSlug || property.bookingSite?.publicSlug || null, reachMedia: property.reachMedia.map((media) => ({ url: media.url })), rooms: property.roomTypes.map((room) => ({ id: room.id, name: room.name, description: room.description, baseRate: numeric(room.baseRate), currency: room.currency, maxOccupancy: room.maxOccupancy, bedConfiguration: room.defaultBedConfig, amenities: room.amenities, photos: room.photos, roomCount: room.rooms.length })) })),
    campaigns: campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name, code: campaign.code, category: campaign.category, targetUrl: reachShareUrl(campaign.code), property: campaign.property })),
    recentClicks: recentClicks.map((click) => ({ id: click.id, propertyName: click.property.name, campaignName: click.campaign?.name || "Referral link", occurredAt: click.occurredAt.toISOString() })),
    recentBookings: recentBookings.map((booking) => ({ id: booking.id, propertyName: booking.property.name, campaignName: booking.campaign?.name || "Referral booking", status: booking.status, commissionAmount: numeric(booking.commission?.amount), commissionStatus: booking.commission?.status || "PENDING", currency: booking.commission?.currency || "NGN", createdAt: booking.createdAt.toISOString() })),
    stats: { properties: properties.length, bookings: bookingCount, fulfilled, clicks: clickCount, conversionRate: clickCount ? Math.round((bookingCount / clickCount) * 1000) / 10 : null, totalCommission, pending: commissions.PENDING?.amount || 0, approved: (commissions.APPROVED?.amount || 0) + (commissions.PAYABLE?.amount || 0), processing: commissions.PROCESSING?.amount || 0, paid: commissions.PAID?.amount || 0, reversed: commissions.REVERSED?.amount || 0, availableBalance: numeric(wallet?.availableBalance), currency: wallet?.currency || "NGN", paidCount },
  };
  return <PartnerDashboard data={data} />;
}
