import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@hotel-pms/db";
import { createPartnerSession } from "@/lib/partner-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const partner = await prisma.referralPartner.findFirst({ where: { email }, select: { id: true, passwordHash: true, status: true } });
  if (!partner?.passwordHash || partner.status !== "ACTIVE" || !(await bcrypt.compare(password, partner.passwordHash))) return NextResponse.json({ error: "Invalid partner credentials" }, { status: 401 });
  await prisma.referralPartner.update({ where: { id: partner.id }, data: { lastLoginAt: new Date() } });
  await createPartnerSession(partner.id);
  return NextResponse.json({ ok: true, redirectTo: "/partner/dashboard" });
}
