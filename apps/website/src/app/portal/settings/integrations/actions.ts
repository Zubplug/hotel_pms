"use server";

import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { hasEntitlement } from "@/lib/auth/entitlement";
import { requireOrganizationContext } from "@/lib/organization-access";
import { encryptBeds24Credentials } from "@/lib/beds24-credentials";
import { revalidatePath } from "next/cache";

const BEDS24_API = "https://api.beds24.com/v2";

function resellerHeaders(propertyId: string) {
  const organizationToken = process.env.BEDS24_ORGANIZATION_TOKEN;
  const accessToken = process.env.BEDS24_ACCESS_TOKEN;
  if (!organizationToken || !accessToken) {
    throw new Error("Beds24 reseller access is not configured. Contact LodgeCore support.");
  }
  return {
    accept: "application/json",
    token: `${accessToken}:p${propertyId}`,
    organisation: organizationToken,
  };
}

export async function authenticateBeds24(externalPropertyId: string) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Unauthorized" };
    const ctx = await requireOrganizationContext(userId);
    const lodgecorePropertyId = ctx.propertyIds[0];
    if (!lodgecorePropertyId || !(await hasEntitlement(ctx.organizationId, "ADDON_BEDS24", lodgecorePropertyId))) {
      return { success: false, error: "An active Beds24 add-on is required." };
    }
    const propertyId = externalPropertyId.trim();
    if (!/^\d+$/.test(propertyId)) return { success: false, error: "Enter a valid numeric Beds24 property ID." };
    const tokenResponse = await fetch(`${BEDS24_API}/properties`, { headers: resellerHeaders(propertyId) });
    if (!tokenResponse.ok) return { success: false, error: `Beds24 reseller access could not read property ${propertyId} (${tokenResponse.status}).` };
    const properties = await tokenResponse.json() as Array<{ id: string | number; name?: string }>;
    const matched = properties.find((property) => String(property.id) === propertyId);
    if (!matched) return { success: false, error: "That property is not activated for LodgeCore in Beds24." };
    return { success: true, property: { id: propertyId, name: matched.name || `Property ${propertyId}` } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to authenticate with Beds24." };
  }
}

export async function connectBeds24(input: { externalPropertyId: string; webhookSecret: string }) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Unauthorized" };
    const ctx = await requireOrganizationContext(userId);
    const propertyId = ctx.propertyIds[0];
    if (!propertyId || !(await hasEntitlement(ctx.organizationId, "ADDON_BEDS24", propertyId))) return { success: false, error: "An active Beds24 add-on is required." };
    if (!input.externalPropertyId.trim() || !input.webhookSecret.trim()) return { success: false, error: "Beds24 property ID and webhook secret are required." };
    resellerHeaders(input.externalPropertyId.trim());
    const validProperty = await prisma.property.findFirst({ where: { id: propertyId, organizationId: ctx.organizationId, isActive: true } });
    if (!validProperty) return { success: false, error: "LodgeCore property not found." };
    await prisma.channelConnection.upsert({
      where: { propertyId_provider: { propertyId, provider: "BEDS24" } },
      update: { externalPropertyId: input.externalPropertyId.trim(), credentialsRef: encryptBeds24Credentials({ mode: "RESELLER", propertyId: input.externalPropertyId.trim(), webhookSecret: input.webhookSecret.trim() }), status: "CONNECTED", lastError: null, lastErrorAt: null },
      create: { organizationId: ctx.organizationId, propertyId, provider: "BEDS24", externalPropertyId: input.externalPropertyId.trim(), credentialsRef: encryptBeds24Credentials({ mode: "RESELLER", propertyId: input.externalPropertyId.trim(), webhookSecret: input.webhookSecret.trim() }), status: "CONNECTED" },
    });
    revalidatePath("/portal/settings/integrations");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to save Beds24 connection." };
  }
}

export async function disconnectBeds24() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Unauthorized" };
    const ctx = await requireOrganizationContext(userId);
    const propertyId = ctx.propertyIds[0];
    if (!propertyId) return { success: false, error: "No active LodgeCore property found." };
    await prisma.channelConnection.updateMany({
      where: { organizationId: ctx.organizationId, propertyId, provider: "BEDS24" },
      data: { status: "DISCONNECTED" },
    });
    revalidatePath("/portal/settings/integrations");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to disconnect Beds24." };
  }
}
