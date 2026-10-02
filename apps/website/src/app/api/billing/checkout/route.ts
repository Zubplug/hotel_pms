import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { billingMetadata, billingPriceIds, createFlutterwaveCheckout, validateCheckoutSelection } from "@hotel-pms/db";

function sameOrigin(value: unknown, fallback: string) { try { const url = new URL(String(value || fallback)); if (url.origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || fallback).origin) return fallback; return url.toString(); } catch { return fallback; } }
export async function POST(request: NextRequest) {
  const session = await auth(); const sessionUser = session?.user as ({ organizationId?: string; email?: string; name?: string } | undefined); const organizationId = sessionUser?.organizationId;
  if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.FLW_SECRET_KEY) return NextResponse.json({ error: "Flutterwave billing is not configured" }, { status: 503 });
  const body = await request.json(); const requestedPriceIds = billingPriceIds(body.priceId, body.priceIds);
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  const customDomainRequestId = typeof body.customDomainRequestId === "string" ? body.customDomainRequestId : null;
  const customWebsiteRequestId = typeof body.customWebsiteRequestId === "string" ? body.customWebsiteRequestId : null;
  if (customDomainRequestId) {
    const domainRequest = await prisma.customDomainRequest.findFirst({ where: { id: customDomainRequestId, organizationId, status: "APPROVED" }, select: { id: true, propertyId: true, amount: true, currency: true, billingPriceId: true } });
    if (!domainRequest) return NextResponse.json({ error: "Custom-domain request is not approved for payment" }, { status: 409 });
    if (!requestedPriceIds.length && domainRequest.billingPriceId) requestedPriceIds.push(domainRequest.billingPriceId);
    body.propertyIds = [domainRequest.propertyId];
  }
  if (customWebsiteRequestId) {
    const websiteRequest = await prisma.customWebsiteRequest.findFirst({ where: { id: customWebsiteRequestId, organizationId, status: "APPROVED" }, select: { propertyId: true, billingPriceId: true } });
    if (!websiteRequest) return NextResponse.json({ error: "Custom website request is not approved for payment" }, { status: 409 });
    if (!requestedPriceIds.length && websiteRequest.billingPriceId) requestedPriceIds.push(websiteRequest.billingPriceId);
    body.propertyIds = [websiteRequest.propertyId];
  }
  if (!requestedPriceIds.length) return NextResponse.json({ error: "Missing catalog price" }, { status: 400 });
  let prices;
  let plan;
  let propertyIds;
  try {
    ({ prices, plan, propertyIds } = await validateCheckoutSelection(prisma, { organizationId, priceIds: requestedPriceIds, planId: typeof body.planId === "string" ? body.planId : null, propertyIds: Array.isArray(body.propertyIds) ? body.propertyIds.map(String) : [] }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid billing selection" }, { status: 400 });
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://getlodgecore.vercel.app";
  const metadata = billingMetadata({ organizationId, planId: plan?.id, propertyIds, productCodes: prices.map((price) => price.product.code), priceIds: prices.map((price) => price.id), customDomainRequestId, customWebsiteRequestId });
  const email = sessionUser?.email;
  if (!email) return NextResponse.json({ error: "A billing email is required" }, { status: 400 });
  const checkout = await createFlutterwaveCheckout({ amount: Math.round(prices.reduce((sum, price) => sum + price.amount, 0) / 100), currency: prices[0]?.currency || "NGN", txRef: `lodgecore-${organizationId}-${randomUUID()}`, redirectUrl: sameOrigin(body.successUrl, `${site}/portal/subscription?success=true`), customer: { email, name: organization.name }, meta: metadata });
  return NextResponse.json({ url: checkout.link });
}
