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
      bookingEngineConfig: { select: { publicSlug: true } },
      bookingSite: { select: { publicSlug: true, status: true } },
      roomTypes: { where: { isActive: true, deletedAt: null }, select: { id: true, name: true, description: true, baseRate: true, currency: true, maxOccupancy: true, defaultBedConfig: true, amenities: true, photos: true, reachMedia: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" } }, rooms: { where: { isActive: true, deletedAt: null }, select: { id: true } } }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  if (!properties.length) return [];
  const subscriptions = await prisma.subscription.findMany({ where: { organizationId: { in: [...new Set(properties.map((property) => property.organizationId))] }, status: { in: ["ACTIVE", "TRIALING"] } }, select: { organizationId: true, scopePropertyIds: true } });
  return properties.filter((property) => subscriptions.some((subscription) => subscription.organizationId === property.organizationId && (!subscription.scopePropertyIds.length || subscription.scopePropertyIds.includes(property.id)))).map((property) => ({ ...property, roomTypes: property.roomTypes.map((room) => ({ ...room, bedConfiguration: room.defaultBedConfig })) }));
}
