import prisma from "@hotel-pms/db";

export async function getPartnerEligibleProperties(organizationId?: string | null) {
  const properties = await prisma.property.findMany({
    where: {
      isActive: true,
      ...(organizationId ? { organizationId } : {}),
      referralProgram: { is: { enabled: true } },
      entitlements: { some: { productCode: "ADDON_REACH", status: "ACTIVE" } },
    },
    select: {
      id: true, organizationId: true, name: true, city: true, state: true, country: true,
      baseCurrency: true, website: true, phone: true,
      reachMedia: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" } },
      referralProgram: { select: { id: true, platformFeeBps: true, minimumPayout: true } },
      referralCampaigns: { where: { isActive: true }, select: { commissionBps: true }, orderBy: { updatedAt: "desc" }, take: 1 },
      bookingEngineConfig: { select: { publicSlug: true } },
      bookingSite: { select: { publicSlug: true, status: true } },
      roomTypes: { where: { isActive: true, deletedAt: null }, select: { id: true, name: true, description: true, baseRate: true, currency: true, maxOccupancy: true, defaultBedConfig: true, amenities: true, photos: true, referralEnabled: true, referralCommissionMode: true, referralCommissionValue: true, reachMedia: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" } }, rooms: { where: { isActive: true, deletedAt: null }, select: { id: true } } }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  if (!properties.length) return [];
  const subscriptions = await prisma.subscription.findMany({ where: { organizationId: { in: [...new Set(properties.map((property) => property.organizationId))] }, status: { in: ["ACTIVE", "TRIALING"] } }, select: { organizationId: true, scopePropertyIds: true } });
  return properties.filter((property) => subscriptions.some((subscription) => subscription.organizationId === property.organizationId && (!subscription.scopePropertyIds.length || subscription.scopePropertyIds.includes(property.id)))).map((property) => ({ ...property, roomTypes: property.roomTypes.map((room) => ({ ...room, bedConfiguration: room.defaultBedConfig })) }));
}

export function roomReferralFeeLabel(room: { referralEnabled: boolean; referralCommissionMode: string; referralCommissionValue: unknown; currency?: string | null }, fallback = "Campaign fee applies") {
  if (!room.referralEnabled) return "No referral commission";
  const value = Number(room.referralCommissionValue || 0);
  if (!(value > 0)) return fallback;
  if (room.referralCommissionMode === "AMOUNT") {
    return `${new Intl.NumberFormat("en-NG", { style: "currency", currency: room.currency || "NGN", maximumFractionDigits: 2 }).format(value)} / night`;
  }
  return `${value}% referral commission`;
}
