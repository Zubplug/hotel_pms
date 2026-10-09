"use server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@hotel-pms/db";
import crypto from "crypto";
import dns from "dns/promises";
import { attachVercelDomain } from "@/lib/custom-domain/vercel";

async function requireBookingEntitlement(organizationId: string, propertyId: string) {
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      organizationId,
      OR: [{ propertyId }, { propertyId: null }],
      productCode: "ADDON_BOOKING_ENGINE",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!entitlement) throw new Error("Booking Engine entitlement is required");
}

// ── Guard ─────────────────────────────────────────────────────────────────

async function requireAccess(organizationId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!property) throw new Error("Property not found");
  return true;
}

// ── Save engine config ────────────────────────────────────────────────────

export async function saveBookingEngineConfig(propertyId: string, formData: FormData) {
  const session = await auth();
  const user = session?.user as { organizationId?: string } | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  await requireAccess(user.organizationId, propertyId);
  await requireBookingEntitlement(user.organizationId, propertyId);

  const enabled = formData.get("enabled") === "true";
  const rawSlug = String(formData.get("publicSlug") ?? "").trim().toLowerCase();
  const publicSlug = rawSlug.replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-");
  const paymentMode = String(formData.get("paymentMode") ?? "PAY_LATER");
  const minStay = Math.max(1, Number(formData.get("minStay") ?? 1));
  const maxStayRaw = formData.get("maxStay");
  const maxStay = maxStayRaw ? Math.max(minStay, Number(maxStayRaw)) : null;
  const bookingLeadTimeHours = Math.max(0, Number(formData.get("bookingLeadTimeHours") ?? 0));
  const maxAdvanceDaysRaw = formData.get("maxAdvanceDays");
  const maxAdvanceDays = maxAdvanceDaysRaw ? Number(maxAdvanceDaysRaw) : null;
  const allowedRatePlanIds = formData.getAll("allowedRatePlanIds").map(String).filter(Boolean);

  if (!publicSlug || publicSlug.length < 3)
    throw new Error("Public slug must be at least 3 characters");
  if (!["FULL", "DEPOSIT", "PAY_LATER"].includes(paymentMode))
    throw new Error("Invalid payment mode");

  const conflict = await prisma.bookingEngineConfig.findFirst({
    where: { publicSlug, propertyId: { not: propertyId } },
  });
  if (conflict) throw new Error("This slug is already in use. Choose another.");

  await prisma.bookingEngineConfig.upsert({
    where: { propertyId },
    create: {
      propertyId,
      organizationId: user.organizationId,
      enabled,
      publicSlug,
      paymentMode,
      minStay,
      maxStay,
      bookingLeadTimeHours,
      maxAdvanceDays,
      allowedRatePlanIds,
    },
    update: {
      enabled,
      publicSlug,
      paymentMode,
      minStay,
      maxStay,
      bookingLeadTimeHours,
      maxAdvanceDays,
      allowedRatePlanIds,
    },
  });
  await prisma.bookingSite.updateMany({
    where: { propertyId },
    data: { publicSlug },
  });

  revalidatePath(`/portal/settings/booking-engine/${propertyId}`);
}

// ── Save site branding ────────────────────────────────────────────────────

export async function saveBookingSite(propertyId: string, formData: FormData) {
  const session = await auth();
  const user = session?.user as { organizationId?: string } | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  await requireAccess(user.organizationId, propertyId);
  await requireBookingEntitlement(user.organizationId, propertyId);

  const config = await prisma.bookingEngineConfig.findUnique({ where: { propertyId } });
  if (!config) throw new Error("Configure the Booking Engine before setting up site branding");

  const siteName = String(formData.get("siteName") ?? "").trim();
  const templateKey = String(formData.get("templateKey") ?? "CLASSIC_HOTEL");
  const primaryColor = String(formData.get("primaryColor") ?? "#1a56db");
  const secondaryColor = String(formData.get("secondaryColor") ?? "#0e9f6e");
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const tagline = String(formData.get("tagline") ?? "").trim() || null;

  if (!siteName) throw new Error("Site name is required");
  if (!["CLASSIC_HOTEL", "MODERN_BOUTIQUE", "RESORT", "BUSINESS_HOTEL"].includes(templateKey)) throw new Error("Invalid booking template");

  await prisma.bookingSite.upsert({
    where: { propertyId },
    create: {
      propertyId,
      organizationId: user.organizationId,
      publicSlug: config.publicSlug,
      siteName,
      templateKey,
      primaryColor,
      secondaryColor,
      logoUrl,
      status: "DRAFT",
      content: tagline ? { tagline } : undefined,
    },
    update: {
      siteName,
      publicSlug: config.publicSlug,
      templateKey,
      primaryColor,
      secondaryColor,
      logoUrl,
      content: tagline ? { tagline } : undefined,
    },
  });

  revalidatePath(`/portal/settings/booking-engine/${propertyId}`);
  revalidatePath(`/book/${config.publicSlug}`);
}

// ── Publish / unpublish ───────────────────────────────────────────────────

export async function publishBookingSite(propertyId: string) {
  const session = await auth();
  const user = session?.user as { organizationId?: string } | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  await requireAccess(user.organizationId, propertyId);
  await requireBookingEntitlement(user.organizationId, propertyId);

  const site = await prisma.bookingSite.findUnique({ where: { propertyId } });
  if (!site) return { ok: false as const, error: "No site configured — complete Branding & Site first" };

  const config = await prisma.bookingEngineConfig.findUnique({ where: { propertyId } });
  if (!config?.enabled) return { ok: false as const, error: "Enable the Booking Engine in Engine settings before publishing" };

  await prisma.bookingSite.update({
    where: { propertyId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  revalidatePath(`/portal/settings/booking-engine/${propertyId}`);
  revalidatePath(`/book/${config.publicSlug}`);
  return { ok: true as const };
}

export async function unpublishBookingSite(propertyId: string) {
  const session = await auth();
  const user = session?.user as { organizationId?: string } | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  await requireAccess(user.organizationId, propertyId);
  await requireBookingEntitlement(user.organizationId, propertyId);

  await prisma.bookingSite.update({
    where: { propertyId },
    data: { status: "DRAFT" },
  });

  revalidatePath(`/portal/settings/booking-engine/${propertyId}`);
  const config = await prisma.bookingEngineConfig.findUnique({ where: { propertyId }, select: { publicSlug: true } });
  if (config) revalidatePath(`/book/${config.publicSlug}`);
}

async function guardedPortalUser(propertyId: string) {
  const session = await auth();
  const user = session?.user as { organizationId?: string } | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  await requireAccess(user.organizationId, propertyId);
  await requireBookingEntitlement(user.organizationId, propertyId);
  return user.organizationId;
}

export async function saveBookingContent(propertyId: string, formData: FormData) {
  const organizationId = await guardedPortalUser(propertyId);
  const config = await prisma.bookingEngineConfig.findUnique({ where: { propertyId } });
  if (!config) throw new Error("Configure the Booking Engine first");
  const existingSite = await prisma.bookingSite.findUnique({ where: { propertyId }, select: { content: true, siteName: true } });
  const content = {
    ...(existingSite?.content && typeof existingSite.content === "object" ? existingSite.content as Record<string, unknown> : {}),
    heroTitle: String(formData.get("heroTitle") ?? "").trim(),
    heroSubtitle: String(formData.get("heroSubtitle") ?? "").trim(),
    amenities: String(formData.get("amenities") ?? "").split("\n").map((v) => v.trim()).filter(Boolean),
    cancellationText: String(formData.get("cancellationText") ?? "").trim(),
    contactPhone: String(formData.get("contactPhone") ?? "").trim(),
    contactEmail: String(formData.get("contactEmail") ?? "").trim(),
  };
  await prisma.bookingSite.upsert({
    where: { propertyId },
    create: { propertyId, organizationId, publicSlug: config.publicSlug, siteName: existingSite?.siteName ?? config.publicSlug, status: "DRAFT", content: content as any },
    update: { content: content as any },
  });
  revalidatePath(`/portal/settings/booking-engine/${propertyId}`);
}

export async function saveBookingPaymentAccount(propertyId: string, formData: FormData) {
  const organizationId = await guardedPortalUser(propertyId);
  const provider = String(formData.get("provider") ?? "PAYSTACK").toUpperCase();
  const mode = String(formData.get("mode") ?? "PLATFORM").toUpperCase();
  const currency = String(formData.get("currency") ?? "NGN").toUpperCase();
  // Flutterwave booking checkout is not enabled until its webhook and provider
  // adapter are deployed; do not allow saving a configuration the API cannot use.
  if (provider !== "PAYSTACK" || !["PLATFORM", "CUSTOMER"].includes(mode)) throw new Error("Only Paystack is currently available for online booking payments");
  await prisma.bookingPaymentAccount.updateMany({ where: { organizationId, propertyId }, data: { isActive: false } });
  await prisma.bookingPaymentAccount.upsert({
    where: { id: String(formData.get("accountId") ?? "00000000-0000-0000-0000-000000000000") },
    create: { organizationId, propertyId, provider, mode, currency, publicKey: String(formData.get("publicKey") ?? "").trim() || null, secretRef: String(formData.get("secretRef") ?? "").trim() || null, webhookSecretRef: String(formData.get("webhookSecretRef") ?? "").trim() || null, isActive: true },
    update: { provider, mode, currency, publicKey: String(formData.get("publicKey") ?? "").trim() || null, secretRef: String(formData.get("secretRef") ?? "").trim() || null, webhookSecretRef: String(formData.get("webhookSecretRef") ?? "").trim() || null, isActive: true },
  });
  revalidatePath(`/portal/settings/booking-engine/${propertyId}`);
}

export async function saveBookingDomain(propertyId: string, formData: FormData) {
  const organizationId = await guardedPortalUser(propertyId);
  const customDomain = String(formData.get("customDomain") ?? "").trim().toLowerCase() || null;
  if (customDomain && !/^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,63}$/.test(customDomain)) throw new Error("Enter a valid hostname");
  if (customDomain) {
    const entitlement = await prisma.entitlement.findFirst({ where: { organizationId, propertyId, productCode: "ADDON_CUSTOM_DOMAIN", status: "ACTIVE" }, select: { id: true } });
    const request = await prisma.customDomainRequest.findFirst({ where: { organizationId, propertyId, domain: customDomain, status: "ACTIVE" }, select: { id: true } });
    if (!entitlement || !request) throw new Error("The custom-domain service must be paid and activated by LodgeCore HQ first");
  }
  await prisma.bookingSite.update({ where: { propertyId }, data: { customDomain, domainStatus: customDomain ? "PENDING" : null, verificationToken: customDomain ? `lodgecore-booking-${crypto.randomUUID()}` : null, verifiedAt: null } });
  revalidatePath(`/portal/settings/booking-engine/${propertyId}`);
}

export async function requestCustomDomain(propertyId: string, formData: FormData) {
  const session = await auth();
  const user = session?.user as { organizationId?: string; email?: string | null } | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  await requireAccess(user.organizationId, propertyId);
  await requireBookingEntitlement(user.organizationId, propertyId);
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!/^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,63}$/.test(domain)) throw new Error("Enter a valid domain name");
  const existing = await prisma.customDomainRequest.findFirst({ where: { organizationId: user.organizationId, propertyId, domain }, select: { id: true, status: true } });
  if (existing && existing.status !== "REJECTED") throw new Error("This domain already has an open request");
  const open = await prisma.customDomainRequest.findFirst({ where: { organizationId: user.organizationId, propertyId, status: { in: ["REQUESTED", "APPROVED", "PAYMENT_PENDING", "PAID", "ACTIVE"] } }, select: { id: true } });
  if (open) throw new Error("This property already has an open custom-domain request");
  const price = await prisma.billingPrice.findFirst({ where: { product: { code: "ADDON_CUSTOM_DOMAIN", active: true }, interval: "month" }, orderBy: { amount: "asc" }, select: { id: true, amount: true, currency: true } });
  const data = { domain, requestedByEmail: user.email ?? null, billingPriceId: price?.id ?? null, amount: price?.amount ?? 0, currency: price?.currency ?? "NGN", status: "REQUESTED" };
  if (existing) await prisma.customDomainRequest.update({ where: { id: existing.id }, data: { ...data, reviewedBy: null, reviewedAt: null, paidAt: null, activatedAt: null, checkoutRef: null } });
  else await prisma.customDomainRequest.create({ data: { organizationId: user.organizationId, propertyId, ...data } });
  revalidatePath(`/portal/settings/booking-engine/${propertyId}`);
}

export async function requestCustomWebsite(propertyId: string, formData: FormData) {
  const session = await auth();
  const user = session?.user as { organizationId?: string; email?: string | null } | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  await requireAccess(user.organizationId, propertyId);
  await requireBookingEntitlement(user.organizationId, propertyId);
  const existing = await prisma.customWebsiteRequest.findFirst({ where: { organizationId: user.organizationId, propertyId, status: { notIn: ["REJECTED", "CANCELLED"] } }, select: { id: true } });
  if (existing) throw new Error("This property already has an open custom website request");
  const brief = String(formData.get("brief") ?? "").trim();
  if (brief.length < 20) throw new Error("Please describe the website you want in at least 20 characters");
  const price = await prisma.billingPrice.findFirst({ where: { product: { code: "ADDON_CUSTOM_WEBSITE_PMS", active: true }, interval: "one_time" }, orderBy: { amount: "asc" }, select: { id: true, amount: true, currency: true } });
  await prisma.customWebsiteRequest.create({ data: { organizationId: user.organizationId, propertyId, developmentMode: "PMS_CONNECTED", requestedByEmail: user.email ?? null, brief, billingPriceId: price?.id ?? null, amount: price?.amount ?? 0, currency: price?.currency ?? "NGN", status: "REQUESTED" } });
  revalidatePath(`/portal/settings/booking-engine/${propertyId}`);
}

export async function verifyBookingDomain(propertyId: string) {
  const organizationId = await guardedPortalUser(propertyId);
  const site = await prisma.bookingSite.findUnique({ where: { propertyId }, select: { customDomain: true, verificationToken: true } });
  if (!site?.customDomain || !site.verificationToken) throw new Error("Configure a custom domain first");
  const entitlement = await prisma.entitlement.findFirst({ where: { organizationId, propertyId, productCode: "ADDON_CUSTOM_DOMAIN", status: "ACTIVE" }, select: { id: true } });
  if (!entitlement) throw new Error("The custom-domain entitlement is not active");
  const records = await dns.resolveTxt(site.customDomain);
  const values = records.flat();
  if (!values.includes(site.verificationToken)) throw new Error("Verification TXT record was not found");
  const result = await attachVercelDomain(site.customDomain);
  await prisma.bookingSite.update({ where: { propertyId }, data: { domainStatus: result.attached ? "ACTIVE" : "VERIFIED", verifiedAt: new Date() } });
  revalidatePath(`/portal/settings/booking-engine/${propertyId}`);
}
