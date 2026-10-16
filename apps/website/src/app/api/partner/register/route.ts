import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@hotel-pms/db";
import { createPartnerSession } from "@/lib/partner-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const password = typeof body.password === "string" ? body.password : "";
  if (displayName.length < 2 || displayName.length > 120) return NextResponse.json({ error: "Enter a valid name or business name" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (password.length < 12) return NextResponse.json({ error: "Password must be at least 12 characters" }, { status: 400 });
  if (body.terms !== true) return NextResponse.json({ error: "Accept the partner terms to continue" }, { status: 400 });
  const existing = await prisma.referralPartner.findFirst({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "A partner account already exists for this email" }, { status: 409 });

  const partner = await prisma.referralPartner.create({
    data: {
      displayName,
      email,
      phone: phone || undefined,
      passwordHash: await bcrypt.hash(password, 12),
      status: "ACTIVE",
      verificationStatus: "PENDING",
      termsAcceptedAt: new Date(),
    },
  });
  await createPartnerSession(partner.id);
  return NextResponse.json({ ok: true, redirectTo: "/partner/dashboard" }, { status: 201 });
}
