import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { PortalShell } from "@/components/portal-shell";
import { BookingEnginePropertyWorkspace } from "./BookingEnginePropertyWorkspace";

export const dynamic = "force-dynamic";

type SessionUser = { organizationId?: string; name?: string | null; email?: string | null };

export default async function BookingEnginePropertyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  const { organizationId } = user;
  const { propertyId } = await params;

  // Verify this property belongs to the org
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { id: true, name: true, isActive: true },
  });
  if (!property) notFound();

  const [entitled, config, site, ratePlans, paymentAccount, domainRequest, websiteRequest] = await Promise.all([
    prisma.entitlement.findFirst({
      where: {
        organizationId,
        OR: [{ propertyId }, { propertyId: null }],
        productCode: { in: ["ADDON_BOOKING_ENGINE", "ADDON_CUSTOM_WEBSITE_API", "ADDON_CUSTOM_WEBSITE_PMS"] },
        status: "ACTIVE",
      },
      select: { id: true },
    }),
    prisma.bookingEngineConfig.findUnique({
      where: { propertyId },
      select: {
        enabled: true,
        publicSlug: true,
        paymentMode: true,
        minStay: true,
        maxStay: true,
        bookingLeadTimeHours: true,
        maxAdvanceDays: true,
        allowedRatePlanIds: true,
      },
    }),
    prisma.bookingSite.findUnique({
      where: { propertyId },
      select: {
        siteName: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        templateKey: true,
        status: true,
        content: true,
        customDomain: true,
        domainStatus: true,
        verificationToken: true,
      },
    }),
    prisma.ratePlan.findMany({
      where: { propertyId, isActive: true, isPublic: true, deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.bookingPaymentAccount.findFirst({ where: { organizationId, propertyId, isActive: true }, select: { id: true, provider: true, mode: true, target: true, currency: true, publicKey: true, secretRef: true, webhookSecretRef: true, secretCiphertext: true, webhookSecretCiphertext: true } }),
    prisma.customDomainRequest.findFirst({
      where: { organizationId, propertyId, status: { notIn: ["REJECTED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      select: { domain: true, status: true, notes: true },
    }),
    prisma.customWebsiteRequest.findFirst({
      where: { organizationId, propertyId, status: { notIn: ["REJECTED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      select: { status: true, brief: true },
    }),
  ]);

  return (
    <PortalShell orgName={undefined} userName={user.name ?? user.email ?? undefined}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/portal/settings/booking-engine"
          style={{
            fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)",
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5,
          }}
        >
          ← Booking Engine
        </Link>
      </div>

      <BookingEnginePropertyWorkspace
        propertyId={propertyId}
        propertyName={property.name}
        entitled={!!entitled}
        config={config ? {
          enabled: config.enabled,
          publicSlug: config.publicSlug,
          paymentMode: config.paymentMode,
          minStay: config.minStay,
          maxStay: config.maxStay,
          bookingLeadTimeHours: config.bookingLeadTimeHours,
          maxAdvanceDays: config.maxAdvanceDays,
          allowedRatePlanIds: config.allowedRatePlanIds,
        } : null}
        site={site ? {
          siteName: site.siteName,
          logoUrl: site.logoUrl,
          primaryColor: site.primaryColor ?? "#1a56db",
          secondaryColor: site.secondaryColor ?? "#0e9f6e",
          templateKey: site.templateKey,
          status: site.status,
          content: site.content as { tagline?: string } | null,
        } : null}
        ratePlans={ratePlans}
        enterpriseSettings={{
          propertyId,
          site: site ? {
            siteName: site.siteName,
            content: site.content as Record<string, any> | null,
            customDomain: site.customDomain,
            domainStatus: site.domainStatus,
            verificationToken: site.verificationToken,
          } : null,
          account: paymentAccount ? { ...paymentAccount, hasCustomerSecret: Boolean(paymentAccount.secretCiphertext), hasCustomerWebhookSecret: Boolean(paymentAccount.webhookSecretCiphertext) } : null,
          domainRequest,
          websiteRequest,
        }}
      />
    </PortalShell>
  );
}
