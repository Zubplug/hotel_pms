import prisma from "@hotel-pms/db";
import { getPartnerEligibleProperties } from "@/lib/partner-reach";

const PAYABLE_STATUSES = ["APPROVED", "PAYABLE", "PAID"];

export async function syncPartnerPropertyWallets(partnerId: string) {
  return prisma.$transaction(async (tx) => {
    const commissions = await tx.referralCommission.findMany({
      where: { partnerId },
      select: { id: true, propertyId: true, amount: true, reversedAmount: true, currency: true, status: true },
      orderBy: { createdAt: "asc" },
    });
    const propertyIds = [...new Set(commissions.map((commission) => commission.propertyId))];
    const wallets = [];
    for (const propertyId of propertyIds) {
      const propertyCommissions = commissions.filter((commission) => commission.propertyId === propertyId);
      const wallet = await tx.referralPartnerPropertyWallet.upsert({
        where: { partnerId_propertyId: { partnerId, propertyId } },
        update: {},
        create: { partnerId, propertyId, currency: propertyCommissions[0]?.currency || "NGN" },
      });
      await tx.$queryRaw`SELECT id FROM "ReferralPartnerPropertyWallet" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
      const transactions = await tx.referralPartnerPropertyWalletTransaction.findMany({
        where: { walletId: wallet.id, commissionId: { not: null } },
        select: { commissionId: true, amount: true },
      });
      const credited = new Map<string, number>();
      for (const transaction of transactions) {
        const commissionId = transaction.commissionId!;
        credited.set(commissionId, (credited.get(commissionId) || 0) + Number(transaction.amount));
      }
      let balance = Number(wallet.availableBalance);
      for (const commission of propertyCommissions) {
        const expected = PAYABLE_STATUSES.includes(commission.status)
          ? Math.max(0, Number(commission.amount) - Number(commission.reversedAmount))
          : 0;
        const delta = expected - (credited.get(commission.id) || 0);
        if (Math.abs(delta) < 0.0001) continue;
        balance += delta;
        await tx.referralPartnerPropertyWallet.update({
          where: { id: wallet.id },
          data: { availableBalance: balance, currency: commission.currency },
        });
        await tx.referralPartnerPropertyWalletTransaction.create({
          data: {
            walletId: wallet.id,
            partnerId,
            propertyId,
            commissionId: commission.id,
            type: delta > 0 ? "COMMISSION_CREDIT" : "COMMISSION_REVERSAL",
            amount: delta,
            balanceAfter: balance,
            currency: commission.currency,
            idempotencyKey: `REACH_PARTNER_PROPERTY_COMMISSION:${commission.id}:${expected.toFixed(4)}`,
            completedAt: new Date(),
          },
        });
      }
      wallets.push(await tx.referralPartnerPropertyWallet.findUniqueOrThrow({ where: { id: wallet.id } }));
    }
    return wallets;
  });
}

export async function getPartnerPropertyWallets(partnerId: string) {
  await syncPartnerPropertyWallets(partnerId);
  return prisma.referralPartnerPropertyWallet.findMany({
    where: { partnerId },
    include: {
      property: { select: { id: true, name: true, baseCurrency: true, referralProgram: { select: { minimumPayout: true } } } },
    },
    orderBy: { property: { name: "asc" } },
  });
}

export async function getPartnerAggregateWalletBalance(partnerId: string) {
  const wallets = await getPartnerPropertyWallets(partnerId);
  const currency = wallets[0]?.currency || "NGN";
  return {
    availableBalance: wallets.filter((wallet) => wallet.currency === currency).reduce((sum, wallet) => sum + Number(wallet.availableBalance), 0),
    currency,
    status: wallets.some((wallet) => wallet.status === "ACTIVE") ? "ACTIVE" : "SUSPENDED",
  };
}

export async function partnerPropertyWalletSnapshot(partnerId: string) {
  const [wallets, properties] = await Promise.all([getPartnerPropertyWallets(partnerId), getPartnerEligibleProperties()]);
  const [transactions, payouts] = await Promise.all([
    prisma.referralPartnerPropertyWalletTransaction.findMany({ where: { partnerId }, include: { property: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.referralPayout.findMany({ where: { partnerId }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, propertyId: true, amount: true, currency: true, status: true, failureReason: true, createdAt: true, processedAt: true } }),
  ]);
  return { wallets, transactions, payouts, properties };
}
