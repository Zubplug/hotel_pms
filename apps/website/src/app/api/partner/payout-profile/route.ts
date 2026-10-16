import { NextRequest, NextResponse } from "next/server";
import prisma from "@hotel-pms/db";
import { getPartnerSession } from "@/lib/partner-auth";

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const bankCode = String(body.bankCode || "").trim();
  const accountNumber = String(body.accountNumber || "").replace(/\D/g, "");
  const accountName = String(body.accountName || "").trim();
  if (!bankCode || !/^\d{10}$/.test(accountNumber) || !accountName) return NextResponse.json({ error: "Bank code, 10-digit account number, and account name are required" }, { status: 400 });
  await prisma.referralPartner.update({ where: { id: partner.id }, data: { payoutProfile: { bankCode, accountNumber, accountName, updatedAt: new Date().toISOString() } } });
  return NextResponse.json({ ok: true, payoutProfile: { bankCode, accountNumber: `******${accountNumber.slice(-4)}`, accountName } });
}
