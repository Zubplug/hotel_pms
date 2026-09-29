import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" }) : null;
function sameOrigin(value: unknown, fallback: string) { try { const url = new URL(String(value || fallback)); if (url.origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || fallback).origin) return fallback; return url.toString(); } catch { return fallback; } }
export async function POST(request: NextRequest) {
  const session = await auth(); const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  const body = await request.json(); const priceId = typeof body.priceId === "string" ? body.priceId : "";
  const price = await prisma.billingPrice.findUnique({ where: { id: priceId }, include: { product: true } });
  if (!price?.stripePriceId || !price.product.active) return NextResponse.json({ error: "Invalid catalog price" }, { status: 400 });
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, include: { billingCustomer: true } });
  if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  let customerId = organization.billingCustomer?.stripeCustomerId;
  if (!customerId) { const customer = await stripe.customers.create({ name: organization.name, metadata: { organizationId } }); customerId = customer.id; await prisma.billingCustomer.create({ data: { organizationId, stripeCustomerId: customerId } }).catch(async () => { customerId = (await prisma.billingCustomer.findUniqueOrThrow({ where: { organizationId } })).stripeCustomerId; }); }
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://getlodgecore.vercel.app";
  const checkout = await stripe.checkout.sessions.create({ customer: customerId, mode: "subscription", line_items: [{ price: price.stripePriceId, quantity: 1 }], success_url: sameOrigin(body.successUrl, `${site}/portal/subscription?success=true`), cancel_url: sameOrigin(body.cancelUrl, `${site}/pricing?canceled=true`), metadata: { organizationId, productCode: price.product.code }, subscription_data: { metadata: { organizationId, productCode: price.product.code } } }, request.headers.get("Idempotency-Key") ? { idempotencyKey: request.headers.get("Idempotency-Key")! } : undefined);
  return NextResponse.json({ url: checkout.url });
}
