import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import prisma from "@hotel-pms/db";
import { getPartnerSession } from "@/lib/partner-auth";
import { attemptPartnerWithdrawal, partnerWalletSnapshot } from "@/lib/partner-wallet";

export async function GET() {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const snapshot = await partnerWalletSnapshot(partner.id);
  return NextResponse.json({
    wallet: { id: snapshot.wallet.id, currency: snapshot.wallet.currency, availableBalance: Number(snapshot.wallet.availableBalance), status: snapshot.wallet.status },
    transactions: snapshot.transactions.map((row: any) => ({ ...row, amount: Number(row.amount), balanceAfter: Number(row.balanceAfter), createdAt: row.createdAt.toISOString() })),
    payouts: snapshot.payouts.map((row: any) => ({ ...row, amount: Number(row.amount), createdAt: row.createdAt.toISOString(), processedAt: row.processedAt?.toISOString() || null })),
    properties: snapshot.properties.map((property: any) => ({ id: property.id, name: property.name, baseCurrency: property.baseCurrency, minimumPayout: Number(property.referralProgram?.minimumPayout || 0) })),
  });
}

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const propertyId = String(body.propertyId || "");
  const amount = Number(body.amount);
  if (!propertyId || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "A valid property and withdrawal amount are required" }, { status: 400 });
  const eligible = await prisma.property.findFirst({ where: { id: propertyId, isActive: true, referralProgram: { is: { enabled: true } }, entitlements: { some: { productCode: "ADDON_REACH", status: "ACTIVE" } } }, select: { id: true, organizationId: true, baseCurrency: true, referralProgram: { select: { minimumPayout: true } } } });
  if (!eligible) return NextResponse.json({ error: "This property is not currently eligible for Reach withdrawals" }, { status: 403 });
  const minimum = Number(eligible.referralProgram?.minimumPayout || 0);
  if (amount < minimum) return NextResponse.json({ error: `The minimum withdrawal is ${eligible.baseCurrency} ${minimum.toLocaleString("en-NG")}` }, { status: 409 });
  const wallet = await prisma.$transaction(async (tx) => {
    const current = await tx.referralPartnerWallet.upsert({ where: { partnerId: partner.id }, update: {}, create: { partnerId: partner.id, currency: eligible.baseCurrency } });
    const reserved = await tx.referralPartnerWallet.updateMany({ where: { id: current.id, status: "ACTIVE", availableBalance: { gte: amount } }, data: { availableBalance: { decrement: amount } } });
    if (reserved.count !== 1) throw new Error("INSUFFICIENT_WALLET_BALANCE");
    const after = Number(current.availableBalance) - amount;
    const payout = await tx.referralPayout.create({ data: { organizationId: eligible.organizationId, propertyId, partnerId: partner.id, amount, currency: eligible.baseCurrency, status: "PROCESSING", payoutReference: `REACH-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`, settlementMethod: "FLUTTERWAVE_TRANSFER" } });
    await tx.referralPartnerWalletTransaction.create({ data: { walletId: current.id, partnerId: partner.id, payoutId: payout.id, type: "WITHDRAWAL_HOLD", amount: -amount, balanceAfter: after, currency: eligible.baseCurrency, idempotencyKey: `REACH_PARTNER_WITHDRAWAL:${payout.id}`, completedAt: new Date() } });
    return payout;
  });
  const result = await attemptPartnerWithdrawal(wallet.id);
  return NextResponse.json({ payoutId: wallet.id, status: result?.status || "PROCESSING", message: result?.status === "PAID" ? "Withdrawal sent to your bank account" : "Withdrawal is processing. The property team has been notified if funding is required." }, { status: 201 });
}
