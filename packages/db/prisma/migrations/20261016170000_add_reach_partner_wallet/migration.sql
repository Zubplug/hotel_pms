-- Partner earnings wallet. This is separate from the organization Reach wallet
-- used to fund property platform fees.
CREATE TABLE IF NOT EXISTS "ReferralPartnerWallet" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "availableBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPartnerWallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPartnerWallet_partnerId_key" ON "ReferralPartnerWallet"("partnerId");
CREATE INDEX IF NOT EXISTS "ReferralPartnerWallet_status_updatedAt_idx" ON "ReferralPartnerWallet"("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "ReferralPartnerWalletTransaction" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "commissionId" UUID,
    "payoutId" UUID,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "amount" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    CONSTRAINT "ReferralPartnerWalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPartnerWalletTransaction_idempotencyKey_key" ON "ReferralPartnerWalletTransaction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ReferralPartnerWalletTransaction_partnerId_createdAt_idx" ON "ReferralPartnerWalletTransaction"("partnerId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralPartnerWalletTransaction_walletId_createdAt_idx" ON "ReferralPartnerWalletTransaction"("walletId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralPartnerWalletTransaction_payoutId_idx" ON "ReferralPartnerWalletTransaction"("payoutId");

ALTER TABLE "ReferralPartnerWallet" ADD CONSTRAINT "ReferralPartnerWallet_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralPartnerWalletTransaction" ADD CONSTRAINT "ReferralPartnerWalletTransaction_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "ReferralPartnerWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralPartnerWalletTransaction" ADD CONSTRAINT "ReferralPartnerWalletTransaction_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralPartnerWalletTransaction" ADD CONSTRAINT "ReferralPartnerWalletTransaction_commissionId_fkey"
  FOREIGN KEY ("commissionId") REFERENCES "ReferralCommission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralPartnerWalletTransaction" ADD CONSTRAINT "ReferralPartnerWalletTransaction_payoutId_fkey"
  FOREIGN KEY ("payoutId") REFERENCES "ReferralPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
