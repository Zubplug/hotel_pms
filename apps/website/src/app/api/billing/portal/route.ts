import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" }) : null;
export async function POST() { const session = await auth(); const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId; if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (!stripe) return NextResponse.json({ error: "Billing is not configured" }, { status: 503 }); const customer = await prisma.billingCustomer.findUnique({ where: { organizationId } }); if (!customer) return NextResponse.json({ error: "No billing customer found" }, { status: 404 }); const portal = await stripe.billingPortal.sessions.create({ customer: customer.stripeCustomerId, return_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://getlodgecore.vercel.app"}/portal/billing` }); return NextResponse.json({ url: portal.url }); }
