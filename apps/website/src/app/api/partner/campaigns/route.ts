import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import prisma from "@hotel-pms/db";
import { getPartnerSession } from "@/lib/partner-auth";
import { getPartnerEligibleProperties } from "@/lib/partner-reach";

export async function GET() {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Partner authentication required" }, { status: 401 });
  const properties = await getPartnerEligibleProperties(partner.organizationId);
  const campaigns = await prisma.referralCampaign.findMany({ where: { partnerId: partner.id, propertyId: { in: properties.map((property) => property.id) } }, include: { property: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Partner authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const propertyId = typeof body.propertyId === "string" ? body.propertyId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.toUpperCase() : "STAY";
  if (!propertyId || name.length < 2 || name.length > 120) return NextResponse.json({ error: "Property and campaign name are required" }, { status: 400 });
  if (!["STAY", "VENUE", "EVENT", "CORPORATE"].includes(category)) return NextResponse.json({ error: "Invalid campaign category" }, { status: 400 });
  const properties = await getPartnerEligibleProperties(partner.organizationId);
  const property = properties.find((item) => item.id === propertyId);
  if (!property || !property.referralProgram) return NextResponse.json({ error: "This property is not currently available for Reach referrals" }, { status: 403 });
  const slug = property.bookingEngineConfig?.publicSlug || property.bookingSite?.publicSlug;
  if (!slug) return NextResponse.json({ error: "This property has no public booking destination" }, { status: 409 });
  const code = `REACH-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const targetUrl = `${siteOrigin}/api/public/booking/${encodeURIComponent(slug)}/reach?campaign=${code}`;
  const campaign = await prisma.referralCampaign.create({ data: { organizationId: property.organizationId, propertyId, programId: property.referralProgram.id, partnerId: partner.id, name, code, category, targetUrl, commissionBps: 700 } });
  return NextResponse.json({ campaign }, { status: 201 });
}
