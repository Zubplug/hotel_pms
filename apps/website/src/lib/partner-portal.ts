import { redirect } from "next/navigation";
import prisma from "@hotel-pms/db";
import { getPartnerSession } from "@/lib/partner-auth";
import { getPartnerEligibleProperties } from "@/lib/partner-reach";

export async function requirePartnerPortal() {
  const partner = await getPartnerSession();
  if (!partner) redirect("/partner/login");
  return partner;
}

export async function getPartnerProperties(partnerId: string, organizationId?: string | null) {
  const properties = await getPartnerEligibleProperties(organizationId);
  return { properties, propertyIds: properties.map((property) => property.id), scope: { partnerId, propertyId: { in: properties.map((property) => property.id) } } };
}

export async function getPartnerWalletBalance(partnerId: string) {
  return prisma.referralPartnerWallet.findUnique({ where: { partnerId }, select: { availableBalance: true, currency: true } });
}
