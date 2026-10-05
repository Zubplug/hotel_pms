import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { billingMetadata, billingPriceIds, billingTotal, createFlutterwaveCheckout, validateCheckoutSelection } from "@hotel-pms/db";

function sameOrigin(value: unknown, fallback: string) { try { const url = new URL(String(value || fallback)); if (url.origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || fallback).origin) return fallback; return url.toString(); } catch { return fallback; } }
function planRank(code: string) { return ({ ESSENTIAL: 1, STARTER: 1, PROFESSIONAL: 2, BUSINESS: 3, ENTERPRISE: 4, ENTERPRISE_PLUS: 5 } as Record<string, number>)[code.toUpperCase()] ?? 0; }
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
  if (plan) {
    const current = await prisma.subscription.findFirst({ where: { organizationId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] }, planId: { not: null } }, orderBy: { createdAt: "desc" }, include: { plan: { select: { code: true } }, items: { include: { price: { include: { product: { select: { code: true } } } } } } } });
    if (current?.plan && planRank(current.plan.code) > planRank(plan.code)) {
      return NextResponse.json({ error: "Downgrades are not available from the subscription portal. Contact billing support to change to a lower plan." }, { status: 409 });
    }
    const targetAmount = prices.reduce((sum, price) => sum + price.amount, 0);
    const now = new Date();
    const canProrate = Boolean(current?.plan && planRank(plan.code) > planRank(current.plan.code) && current.currentPeriodEnd > now && current.currentPeriodStart < now);
    const currentAmount = canProrate ? current!.items.filter((item) => item.price.interval === prices[0]?.interval && item.price.product.code.toUpperCase().startsWith("PLAN_")).reduce((sum, item) => sum + item.price.amount, 0) : 0;
    const periodLength = current ? current.currentPeriodEnd.getTime() - current.currentPeriodStart.getTime() : 0;
    const remaining = current ? Math.max(0, current.currentPeriodEnd.getTime() - now.getTime()) : 0;
    const upgradeCredit = canProrate && currentAmount > 0 && periodLength > 0 ? Math.min(currentAmount, Math.round(currentAmount * remaining / periodLength)) : 0;
    const chargeAmount = canProrate ? Math.max(100, targetAmount - upgradeCredit) : targetAmount;
    if (canProrate) {
      (body as Record<string, unknown>).__upgrade = { chargeAmount, upgradeCredit, periodEnd: current!.currentPeriodEnd.toISOString() };
    }
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://getlodgecore.vercel.app";
  const upgrade = (body as Record<string, unknown>).__upgrade as { chargeAmount: number; upgradeCredit: number; periodEnd: string } | undefined;
  const metadata = billingMetadata({ organizationId, planId: plan?.id, propertyIds, productCodes: prices.map((price) => price.product.code), priceIds: prices.map((price) => price.id), customDomainRequestId, customWebsiteRequestId, upgradeCredit: upgrade?.upgradeCredit, upgradePeriodEnd: upgrade?.periodEnd });
  const email = sessionUser?.email;
  if (!email) return NextResponse.json({ error: "A billing email is required" }, { status: 400 });
  const checkoutTotal = billingTotal(prices, propertyIds);
  const checkout = await createFlutterwaveCheckout({ amount: Math.round((upgrade?.chargeAmount ?? checkoutTotal) / 100), currency: prices[0]?.currency || "NGN", txRef: `lodgecore-${organizationId}-${randomUUID()}`, redirectUrl: sameOrigin(body.successUrl, `${site}/portal/subscription?success=true`), customer: { email, name: organization.name }, meta: metadata });
  return NextResponse.json({ url: checkout.link });
}
