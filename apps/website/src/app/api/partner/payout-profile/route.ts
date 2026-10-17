import { NextRequest, NextResponse } from "next/server";
import prisma from "@hotel-pms/db";
import { getPartnerSession } from "@/lib/partner-auth";
import { verifyPartnerFlutterwaveAccount } from "@/lib/partner-payout-verification";

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const propertyId = String(body.propertyId || "").trim();
  const bankCode = String(body.bankCode || "").trim();
  const accountNumber = String(body.accountNumber || "").replace(/\D/g, "");
  if (!propertyId || !bankCode || !/^\d{10}$/.test(accountNumber)) return NextResponse.json({ error: "Property, bank, and a 10-digit account number are required" }, { status: 400 });
  try {
    const verified = await verifyPartnerFlutterwaveAccount({ partner, propertyId, bankCode, accountNumber });
    const existing = partner.payoutProfile && typeof partner.payoutProfile === "object" ? partner.payoutProfile as Record<string, unknown> : {};
    const accounts = existing.accounts && typeof existing.accounts === "object" ? existing.accounts as Record<string, unknown> : {};
    const account = { propertyId, bankCode, accountNumber, accountName: verified.account_name, verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await prisma.referralPartner.update({ where: { id: partner.id }, data: { payoutProfile: { ...existing, ...account, accounts: { ...accounts, [propertyId]: account } } as any } });
    return NextResponse.json({ ok: true, payoutProfile: { propertyId, bankCode, accountNumber: `******${accountNumber.slice(-4)}`, accountName: verified.account_name } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Flutterwave could not verify this account" }, { status: 422 });
  }
}
