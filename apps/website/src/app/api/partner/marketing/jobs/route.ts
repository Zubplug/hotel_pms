import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import prisma from "@hotel-pms/db";
import { getPartnerSession } from "@/lib/partner-auth";
import { getPartnerEligibleProperties } from "@/lib/partner-reach";
import { enqueueReachCreative } from "@/lib/reach-creative-jobs";
import { CREATIVE_TEMPLATES } from "@/lib/reach-creative-renderer";

export async function GET() {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const properties = await getPartnerEligibleProperties(partner.organizationId);
  const jobs = await prisma.reachCreativeGeneration.findMany({ where: { partnerId: partner.id, propertyId: { in: properties.map((property) => property.id) } }, orderBy: { createdAt: "desc" }, take: 50, include: { property: { select: { name: true } }, campaign: { select: { name: true } } } });
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { campaignId?: string; template?: string; idempotencyKey?: string } | null;
  const template = body?.template as keyof typeof CREATIVE_TEMPLATES;
  if (!body?.campaignId || !CREATIVE_TEMPLATES[template]) return NextResponse.json({ error: "campaignId and a supported template are required" }, { status: 400 });
  const campaign = await prisma.referralCampaign.findFirst({ where: { id: body.campaignId, partnerId: partner.id, isActive: true }, include: { property: { select: { id: true, name: true, reachMedia: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } } } });
  if (!campaign) return NextResponse.json({ error: "Campaign is not available" }, { status: 404 });
  const key = body.idempotencyKey?.slice(0, 200) || crypto.createHash("sha256").update(`${partner.id}:${campaign.id}:${template}:${campaign.property.reachMedia[0]?.url || "none"}`).digest("hex");
  const existing = await prisma.reachCreativeGeneration.findUnique({ where: { idempotencyKey: key }, include: { property: { select: { name: true } }, campaign: { select: { name: true } } } });
  if (existing) return NextResponse.json({ job: existing, existing: true });
  let job;
  try {
    job = await prisma.reachCreativeGeneration.create({ data: { organizationId: campaign.organizationId, partnerId: partner.id, propertyId: campaign.propertyId, campaignId: campaign.id, idempotencyKey: key, template, width: CREATIVE_TEMPLATES[template].width, height: CREATIVE_TEMPLATES[template].height, sourceUrl: campaign.property.reachMedia[0]?.url || null } });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const duplicate = await prisma.reachCreativeGeneration.findUnique({ where: { idempotencyKey: key }, include: { property: { select: { name: true } }, campaign: { select: { name: true } } } });
    if (duplicate) return NextResponse.json({ job: duplicate, existing: true });
    throw error;
  }
  try {
    await enqueueReachCreative(job.id, new URL(request.url).origin);
  } catch (error) {
    await prisma.reachCreativeGeneration.update({ where: { id: job.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Unable to queue generation" } });
    return NextResponse.json({ error: "Unable to queue creative generation" }, { status: 502 });
  }
  return NextResponse.json({ job }, { status: 202 });
}
