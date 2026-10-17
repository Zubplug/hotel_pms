import { createFlutterwaveTransfer, prisma } from "@hotel-pms/db";
import { getPartnerEligibleProperties } from "@/lib/partner-reach";
import { decryptPaymentCredential } from "@/lib/payment-providers/credentials";
import { resolveSecretRef } from "@/lib/payment-providers/booking-account";
import { partnerPropertyWalletSnapshot } from "@/lib/partner-property-wallet";

const PAYABLE_STATUSES = ["APPROVED", "PAYABLE", "PAID"];

export async function syncPartnerWallet(partnerId: string) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.referralPartnerWallet.upsert({
      where: { partnerId },
      update: {},
      create: { partnerId, currency: "NGN" },
    });
    await tx.$queryRaw`SELECT id FROM "ReferralPartnerWallet" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
    const commissions = await tx.referralCommission.findMany({
      where: { partnerId, status: { in: PAYABLE_STATUSES } },
      select: { id: true, amount: true, reversedAmount: true, currency: true },
    });
    let balance = Number(wallet.availableBalance);
    for (const commission of commissions) {
      const net = Math.max(0, Number(commission.amount) - Number(commission.reversedAmount));
      if (net <= 0) continue;
      const key = `REACH_PARTNER_COMMISSION:${commission.id}`;
      const existing = await tx.referralPartnerWalletTransaction.findUnique({ where: { idempotencyKey: key } });
      if (existing) continue;
      balance += net;
      await tx.referralPartnerWallet.update({ where: { id: wallet.id }, data: { availableBalance: balance, currency: commission.currency } });
      await tx.referralPartnerWalletTransaction.create({
        data: { walletId: wallet.id, partnerId, commissionId: commission.id, type: "COMMISSION_CREDIT", amount: net, balanceAfter: balance, currency: commission.currency, idempotencyKey: key, completedAt: new Date() },
      });
    }
    return tx.referralPartnerWallet.findUniqueOrThrow({ where: { id: wallet.id } });
  });
}

export async function notifyPropertyFundingRequired(input: { organizationId: string; propertyId: string; payoutId: string; amount: number; currency: string; reason: string }) {
  const recipients = await prisma.userRole.findMany({
    where: {
      role: { name: { in: ["ACCOUNTANT", "FINANCE_MANAGER", "GENERAL_MANAGER", "HOTEL_MANAGER", "GENERAL_CASHIER"] } },
      user: { membership: { organizationId: input.organizationId } },
      OR: [{ propertyId: input.propertyId }, { propertyId: null }],
    },
    select: { userId: true },
  });
  const userIds = [...new Set(recipients.map((row) => row.userId))];
  if (!userIds.length) return;
  await prisma.notification.createMany({
    data: userIds.map((recipientId) => ({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      recipientType: "staff",
      recipientId,
      status: "sent",
      channel: "in_app",
      category: "FINANCE",
      priority: "P1",
      subject: "Reach partner withdrawal awaiting property funding",
      body: `Flutterwave could not fund Reach withdrawal ${input.payoutId} for ${input.currency} ${input.amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}. Fund the property account and retry. The withdrawal remains PROCESSING. Reason: ${input.reason}`,
      action: `/referrals/payouts/${input.payoutId}`,
      metadata: { source: "REACH_PARTNER_WITHDRAWAL", payoutId: input.payoutId, amount: input.amount, currency: input.currency },
      groupKey: `REACH_PAYOUT_FUNDING:${input.payoutId}`,
    })),
  });
}

function isFundingError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /(insufficient|balance|fund|float|wallet|debit)/i.test(message);
}

async function propertyFlutterwaveSecret(organizationId: string, propertyId: string) {
  const account = await prisma.bookingPaymentAccount.findFirst({
    where: { organizationId, propertyId, provider: "FLUTTERWAVE", mode: "CUSTOMER", isActive: true },
    select: { secretCiphertext: true, secretRef: true, payrollEnabled: true },
  });
  if (!account?.payrollEnabled) throw new Error("Property Flutterwave payout account is not enabled");
  return account.secretCiphertext ? decryptPaymentCredential(account.secretCiphertext) : resolveSecretRef(account.secretRef, "FLW_SECRET_KEY");
}

export async function attemptPartnerWithdrawal(payoutId: string) {
  const payout = await prisma.referralPayout.findUnique({ where: { id: payoutId }, include: { partner: true } });
  if (!payout || !["PENDING", "PROCESSING"].includes(payout.status)) return payout;
  const storedProfile = (payout.partner.payoutProfile || {}) as Record<string, unknown>;
  const accounts = storedProfile.accounts && typeof storedProfile.accounts === "object" ? storedProfile.accounts as Record<string, unknown> : {};
  const profile = (accounts[payout.propertyId] && typeof accounts[payout.propertyId] === "object" ? accounts[payout.propertyId] : storedProfile) as Record<string, unknown>;
  if (String(profile.propertyId || "") !== payout.propertyId) throw new Error("Payout account is not verified for this property");
  const bankCode = String(profile.bankCode || "").trim();
  const accountNumber = String(profile.accountNumber || "").replace(/\D/g, "");
  const beneficiaryName = String(profile.accountName || payout.partner.displayName).trim();
  if (!bankCode || !/^\d{10}$/.test(accountNumber)) throw new Error("Partner payout bank details are incomplete");
  const reference = payout.payoutReference || `REACH-${payout.id.slice(0, 12).toUpperCase()}`;
  await prisma.referralPayout.update({ where: { id: payout.id }, data: { status: "PROCESSING", payoutReference: reference, settlementMethod: "FLUTTERWAVE_TRANSFER" } });
  try {
    const secretKey = await propertyFlutterwaveSecret(payout.organizationId, payout.propertyId);
    const transfer = await createFlutterwaveTransfer({ secretKey, amount: Number(payout.amount), currency: payout.currency, bankCode, accountNumber, beneficiaryName, reference, narration: "LodgeCore Reach partner commission", meta: { payoutId: payout.id, partnerId: payout.partnerId, propertyId: payout.propertyId } });
    const successful = ["SUCCESSFUL", "COMPLETED"].includes(String(transfer.status).toUpperCase());
    await prisma.referralPayout.update({ where: { id: payout.id }, data: { status: successful ? "PAID" : "PROCESSING", processedAt: successful ? new Date() : null, failureReason: successful ? null : `Flutterwave status: ${transfer.status}` } });
    return { status: successful ? "PAID" : "PROCESSING", transfer };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Flutterwave transfer could not be initiated";
    await prisma.referralPayout.update({ where: { id: payout.id }, data: { status: "PROCESSING", failureReason: reason.slice(0, 500) } });
    if (isFundingError(error)) await notifyPropertyFundingRequired({ organizationId: payout.organizationId, propertyId: payout.propertyId, payoutId: payout.id, amount: Number(payout.amount), currency: payout.currency, reason });
    return { status: "PROCESSING", reason, fundingRequired: isFundingError(error) };
  }
}

export async function partnerWalletSnapshot(partnerId: string) {
  const snapshot = await partnerPropertyWalletSnapshot(partnerId);
  const wallet = {
    id: snapshot.wallets[0]?.id || partnerId,
    currency: snapshot.wallets[0]?.currency || "NGN",
    availableBalance: snapshot.wallets.reduce((sum, item) => sum + Number(item.availableBalance), 0),
    status: snapshot.wallets.some((item) => item.status === "ACTIVE") ? "ACTIVE" : "SUSPENDED",
  };
  return { ...snapshot, wallet };
}
