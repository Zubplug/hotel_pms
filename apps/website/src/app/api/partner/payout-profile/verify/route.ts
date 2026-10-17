import { NextRequest, NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-auth";
import { listPartnerFlutterwaveBanks, verifyPartnerFlutterwaveAccount } from "@/lib/partner-payout-verification";

export async function GET(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const propertyId = request.nextUrl.searchParams.get("propertyId") || "";
  if (!propertyId) return NextResponse.json({ error: "A property is required" }, { status: 400 });
  try {
    return NextResponse.json({ banks: await listPartnerFlutterwaveBanks(partner, propertyId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Flutterwave banks" }, { status: 409 });
  }
}

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const propertyId = String(body.propertyId || "");
  const bankCode = String(body.bankCode || "").trim();
  const accountNumber = String(body.accountNumber || "").replace(/\D/g, "");
  if (!propertyId) return NextResponse.json({ error: "A property is required" }, { status: 400 });
  try {
    const result = await verifyPartnerFlutterwaveAccount({ partner, propertyId, bankCode, accountNumber });
    return NextResponse.json({ verified: true, accountNumber: result.account_number, accountName: result.account_name });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Flutterwave could not verify this account" }, { status: 422 });
  }
}
