import { NextResponse } from "next/server";
import prisma from "@hotel-pms/db";
import { getPartnerSession } from "@/lib/partner-auth";
import { attemptPartnerWithdrawal } from "@/lib/partner-wallet";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await context.params;
  const payout = await prisma.referralPayout.findFirst({ where: { id, partnerId: partner.id, status: "PROCESSING" }, select: { id: true } });
  if (!payout) return NextResponse.json({ error: "Processing withdrawal not found" }, { status: 404 });
  const result = await attemptPartnerWithdrawal(payout.id);
  return NextResponse.json({ status: result?.status || "PROCESSING", message: result?.status === "PAID" ? "Withdrawal sent" : "Withdrawal remains processing; retry after the property account is funded" });
}
