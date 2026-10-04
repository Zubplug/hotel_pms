"use server";

import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { hasEntitlement } from "@/lib/auth/entitlement";
import { requireOrganizationContext } from "@/lib/organization-access";
import { encryptBeds24Credentials } from "@/lib/beds24-credentials";
import { revalidatePath } from "next/cache";

const BEDS24_API = "https://api.beds24.com/v2";

export async function authenticateBeds24(inviteCode: string, webhookSecret: string) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Unauthorized" };
    const ctx = await requireOrganizationContext(userId);
    const propertyId = ctx.propertyIds[0];
    if (!propertyId || !(await hasEntitlement(ctx.organizationId, "ADDON_BEDS24", propertyId))) {
      return { success: false, error: "An active Beds24 add-on is required." };
    }
    if (!inviteCode.trim() || !webhookSecret.trim()) return { success: false, error: "Invite code and webhook secret are required." };
    const response = await fetch(`${BEDS24_API}/authentication/setup`, { method: "GET", headers: { inviteCode: inviteCode.trim() } });
    if (!response.ok) return { success: false, error: `Beds24 authentication failed (${response.status}).` };
    const data = await response.json() as { refreshToken?: string; token?: string; expiresIn?: number };
    if (!data.refreshToken) return { success: false, error: "Beds24 did not return a refresh token." };
    const tokenResponse = await fetch(`${BEDS24_API}/properties`, { headers: { token: data.token ?? "" } });
    if (!tokenResponse.ok) return { success: false, error: "Beds24 authentication succeeded, but properties could not be loaded." };
    const properties = await tokenResponse.json() as Array<{ id: string | number; name?: string }>;
    return { success: true, properties: properties.map((property) => ({ id: String(property.id), name: property.name || `Property ${property.id}` })), refreshToken: data.refreshToken, propertyId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to authenticate with Beds24." };
  }
}

export async function connectBeds24(input: { externalPropertyId: string; refreshToken: string; webhookSecret: string }) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Unauthorized" };
    const ctx = await requireOrganizationContext(userId);
    const propertyId = ctx.propertyIds[0];
    if (!propertyId || !(await hasEntitlement(ctx.organizationId, "ADDON_BEDS24", propertyId))) return { success: false, error: "An active Beds24 add-on is required." };
    const validProperty = await prisma.property.findFirst({ where: { id: propertyId, organizationId: ctx.organizationId, isActive: true } });
    if (!validProperty) return { success: false, error: "LodgeCore property not found." };
    await prisma.channelConnection.upsert({
      where: { propertyId_provider: { propertyId, provider: "BEDS24" } },
      update: { externalPropertyId: input.externalPropertyId, credentialsRef: encryptBeds24Credentials({ refreshToken: input.refreshToken, webhookSecret: input.webhookSecret }), status: "CONNECTED" },
      create: { organizationId: ctx.organizationId, propertyId, provider: "BEDS24", externalPropertyId: input.externalPropertyId, credentialsRef: encryptBeds24Credentials({ refreshToken: input.refreshToken, webhookSecret: input.webhookSecret }), status: "CONNECTED" },
    });
    revalidatePath("/portal/settings/integrations");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to save Beds24 connection." };
  }
}
