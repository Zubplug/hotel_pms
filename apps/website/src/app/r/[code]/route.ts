import { NextRequest, NextResponse } from "next/server";
import prisma from "@hotel-pms/db";
import { recordReachClick } from "@/lib/reach-attribution";

function safeWebsite(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/** Public, shareable Reach link. Tracking stays behind this friendly URL. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const campaign = await prisma.referralCampaign.findFirst({
    where: { code: code.trim(), isActive: true },
    select: {
      code: true,
      propertyId: true,
      property: {
        select: {
          website: true,
          propertyIntegrations: {
            where: { provider: "CUSTOM_WEBSITE", status: "ACTIVE" },
            select: { id: true },
            take: 1,
          },
          bookingEngineConfig: { select: { publicSlug: true } },
          bookingSite: { select: { publicSlug: true } },
        },
      },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign is unavailable" }, { status: 404 });

  const click = await recordReachClick(prisma, {
    propertyId: campaign.propertyId,
    campaignCode: campaign.code,
    landingPath: req.nextUrl.pathname,
  });

  const website = campaign.property.propertyIntegrations.length
    ? safeWebsite(campaign.property.website)
    : null;
  const slug = campaign.property.bookingEngineConfig?.publicSlug || campaign.property.bookingSite?.publicSlug;
  const destination = website ?? (slug ? new URL(`/book/${encodeURIComponent(slug)}`, req.url) : null);
  if (!destination) return NextResponse.json({ error: "This property has no valid public destination" }, { status: 409 });
  if (click) destination.searchParams.set("reach", click.referralToken);
  return NextResponse.redirect(destination);
}
