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
  if (!requestedPriceIds.length) return NextResponse.json({ error: "Missing catalog price" }, { status: 400 });
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  let prices;
  let plan;
  let propertyIds;
  try {
    ({ prices, plan, propertyIds } = await validateCheckoutSelection(prisma, { organizationId, priceIds: requestedPriceIds, planId: typeof body.planId === "string" ? body.planId : null, propertyIds: Array.isArray(body.propertyIds) ? body.propertyIds.map(String) : [] }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid billing selection" }, { status: 400 });
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://getlodgecore.vercel.app";
  const metadata = billingMetadata({ organizationId, planId: plan?.id, propertyIds, productCodes: prices.map((price) => price.product.code), priceIds: prices.map((price) => price.id) });
  const email = sessionUser?.email;
  if (!email) return NextResponse.json({ error: "A billing email is required" }, { status: 400 });
  const checkout = await createFlutterwaveCheckout({ amount: Math.round(prices.reduce((sum, price) => sum + price.amount, 0) / 100), currency: prices[0]?.currency || "NGN", txRef: `lodgecore-${organizationId}-${randomUUID()}`, redirectUrl: sameOrigin(body.successUrl, `${site}/portal/subscription?success=true`), customer: { email, name: organization.name }, meta: metadata });
  return NextResponse.json({ url: checkout.link });
}
