import { redirect } from "next/navigation";
import prisma from "@hotel-pms/db";
import { getPartnerSession } from "@/lib/partner-auth";
import { getPartnerEligibleProperties } from "@/lib/partner-reach";
import { PartnerDashboard } from "./PartnerDashboard";

export default async function PartnerDashboardPage() {
  const partner = await getPartnerSession();
  if (!partner) redirect("/partner/login");
  const properties = await getPartnerEligibleProperties(partner.organizationId);
  const propertyIds = properties.map((property) => property.id);
  const [campaigns, bookings] = await Promise.all([
    prisma.referralCampaign.findMany({ where: { partnerId: partner.id, propertyId: { in: propertyIds } }, include: { property: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.referralBooking.findMany({ where: { partnerId: partner.id, propertyId: { in: propertyIds } }, select: { status: true, commission: { select: { amount: true, status: true } } } }),
  ]);
  const roomProperties = properties.map((property) => ({ id: property.id, name: property.name, city: property.city, state: property.state, country: property.country, baseCurrency: property.baseCurrency, phone: property.phone, website: property.website, rooms: property.roomTypes.map((room) => ({ id: room.id, name: room.name, description: room.description, baseRate: Number(room.baseRate), currency: room.currency, maxOccupancy: room.maxOccupancy, bedConfiguration: room.defaultBedConfig, amenities: room.amenities, photos: room.photos, roomCount: room.rooms.length })) }));
  return <PartnerDashboard data={{ partner: { displayName: partner.displayName, email: partner.email || "", verificationStatus: partner.verificationStatus }, properties: roomProperties, campaigns: campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name, code: campaign.code, category: campaign.category, targetUrl: campaign.targetUrl, property: campaign.property })), stats: { bookings: bookings.length, fulfilled: bookings.filter((booking) => booking.status === "FULFILLED").length, commission: bookings.reduce((sum, booking) => sum + Number(booking.commission?.amount || 0), 0), approved: bookings.filter((booking) => ["APPROVED", "PAYABLE", "PAID"].includes(booking.commission?.status || "")).length } }} />;
}
