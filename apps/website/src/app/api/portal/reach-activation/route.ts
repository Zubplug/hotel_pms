import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import prisma, { createFlutterwaveCheckout } from "@hotel-pms/db";

async function context() {
  const session = await auth();
  const user = session?.user as { organizationId?: string; email?: string; name?: string | null } | undefined;
  return user?.organizationId ? { ...user, organizationId: user.organizationId } : null;
}

export async function GET() {
  const user = await context();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [properties, entitlements] = await Promise.all([
    prisma.property.findMany({ where: { organizationId: user.organizationId, isActive: true }, select: { id: true, name: true, baseCurrency: true }, orderBy: { name: "asc" } }),
    prisma.entitlement.findMany({ where: { organizationId: user.organizationId, status: "ACTIVE", productCode: { in: ["ADDON_BOOKING_ENGINE", "ADDON_CUSTOM_WEBSITE_API", "ADDON_CUSTOM_WEBSITE_PMS"] }, OR: [{ propertyId: null }, { propertyId: { not: null } }] }, select: { propertyId: true, productCode: true } }),
  ]);
  const [programs, activationProduct, discount] = await Promise.all([
    prisma.referralProgram.findMany({ where: { organizationId: user.organizationId, propertyId: { in: properties.map((property) => property.id) } } }),
    prisma.billingProduct.findUnique({ where: { code: "ADDON_REACH" }, include: { prices: { where: { interval: "one_time" }, orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.organizationBillingDiscount.findFirst({ where: { organizationId: user.organizationId, product: { code: "ADDON_REACH" }, active: true, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { percentage: "desc" }, select: { percentage: true } }),
  ]);
  const activationPrice = activationProduct?.prices[0];
  const discountPercentage = discount ? Number(discount.percentage) : 0;
  const discountedActivationAmount = activationPrice ? Math.max(1, Math.round(activationPrice.amount * (1 - discountPercentage / 100))) : null;
  const result = properties.map((property) => {
    const eligible = entitlements.some((item) => item.propertyId === null || item.propertyId === property.id);
    const program = programs.find((item) => item.propertyId === property.id);
    return { id: property.id, name: property.name, eligible, program: program ? { enabled: program.enabled, activationPaymentStatus: program.activationPaymentStatus, activationFeeAmount: discountedActivationAmount ? discountedActivationAmount / 100 : Number(program.activationFeeAmount), activationFeeCurrency: activationPrice?.currency || program.activationFeeCurrency } : { enabled: false, activationPaymentStatus: "NOT_PAID", activationFeeAmount: discountedActivationAmount ? discountedActivationAmount / 100 : 50000, activationFeeCurrency: activationPrice?.currency || property.baseCurrency } };
  });
  return NextResponse.json({ properties: result });
}

export async function POST(request: NextRequest) {
  const user = await context();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.FLW_SECRET_KEY) return NextResponse.json({ error: "Flutterwave activation billing is not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const propertyId = typeof body.propertyId === "string" ? body.propertyId : "";
  const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId: user.organizationId, isActive: true }, select: { id: true, name: true, baseCurrency: true } });
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });
  const eligible = await prisma.entitlement.count({ where: { organizationId: user.organizationId, status: "ACTIVE", productCode: { in: ["ADDON_BOOKING_ENGINE", "ADDON_CUSTOM_WEBSITE_API", "ADDON_CUSTOM_WEBSITE_PMS"] }, OR: [{ propertyId: null }, { propertyId }] } });
  if (!eligible) return NextResponse.json({ error: "An active Booking Engine, Standalone API, or PMS Website add-on is required" }, { status: 402 });
  if (!user.email) return NextResponse.json({ error: "A billing email is required" }, { status: 400 });
  const activationPrice = await prisma.billingPrice.findFirst({ where: { product: { code: "ADDON_REACH", active: true }, interval: "one_time" }, orderBy: { createdAt: "desc" } });
  if (!activationPrice) return NextResponse.json({ error: "Reach activation pricing is not configured by LodgeCore HQ" }, { status: 503 });
  const discount = await prisma.organizationBillingDiscount.findFirst({ where: { organizationId: user.organizationId, product: { code: "ADDON_REACH" }, active: true, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { percentage: "desc" }, select: { percentage: true } });
  const discountPercentage = discount ? Number(discount.percentage) : 0;
  const payableAmount = Math.max(1, Math.round(activationPrice.amount * (1 - discountPercentage / 100)));
  const program = await prisma.referralProgram.upsert({ where: { propertyId }, create: { organizationId: user.organizationId, propertyId, activationFeeAmount: payableAmount / 100, activationFeeCurrency: activationPrice.currency, activationPaymentStatus: "PENDING" }, update: { activationFeeAmount: payableAmount / 100, activationFeeCurrency: activationPrice.currency, activationPaymentStatus: "PENDING" } });
  if (program.enabled) return NextResponse.json({ enabled: true });
  const providerReference = `reach-activation-${propertyId}-${randomUUID()}`;
  const payment = await prisma.referralActivationPayment.create({ data: { organizationId: user.organizationId, propertyId, programId: program.id, amount: payableAmount / 100, currency: activationPrice.currency, providerReference } });
  const checkout = await createFlutterwaveCheckout({ amount: payableAmount / 100, currency: activationPrice.currency, txRef: providerReference, redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://getlodgecore.vercel.app"}/portal/subscription?reachActivation=true`, customer: { email: user.email, name: user.name || property.name }, meta: { lodgecore_source: "reach_activation", organizationId: user.organizationId, activationPaymentId: payment.id, propertyId, productCodes: "ADDON_REACH", priceIds: activationPrice.id, originalAmount: String(activationPrice.amount / 100), discountPercentage: String(discountPercentage) } });
  return NextResponse.json({ checkoutUrl: checkout.link, paymentId: payment.id });
}
