import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@hotel-pms/db";
import { createPartnerSession } from "@/lib/partner-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const middleName = typeof body.middleName === "string" ? body.middleName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const password = typeof body.password === "string" ? body.password : "";
  if (firstName.length < 2 || firstName.length > 80) return NextResponse.json({ error: "Enter a valid first name" }, { status: 400 });
  if (middleName.length > 80) return NextResponse.json({ error: "Enter a valid middle name" }, { status: 400 });
  if (lastName.length < 2 || lastName.length > 80) return NextResponse.json({ error: "Enter a valid last name" }, { status: 400 });
  if (businessName.length > 160) return NextResponse.json({ error: "Enter a valid business or company name" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (password.length < 12) return NextResponse.json({ error: "Password must be at least 12 characters" }, { status: 400 });
  if (body.terms !== true) return NextResponse.json({ error: "Accept the partner terms to continue" }, { status: 400 });
  const existing = await prisma.referralPartner.findFirst({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "A partner account already exists for this email" }, { status: 409 });

  const partner = await prisma.referralPartner.create({
    data: {
      firstName,
      middleName: middleName || undefined,
      lastName,
      businessName: businessName || undefined,
      // Keep displayName as the dashboard/public compatibility label.
      displayName: businessName || [firstName, middleName, lastName].filter(Boolean).join(" "),
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
