ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "staffId" UUID;
ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "isStaffReferrer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReferralProgram" ADD COLUMN IF NOT EXISTS "staffReferralEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReferralCommission" ADD COLUMN IF NOT EXISTS "payslipId" UUID;
ALTER TABLE "ReferralCommission" ADD COLUMN IF NOT EXISTS "payslipInjectedAt" TIMESTAMPTZ;
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "referralCommission" DECIMAL(18,4) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPartner_staffId_key" ON "ReferralPartner"("staffId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_payslipId_idx" ON "ReferralCommission"("payslipId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReferralPartner_staffId_fkey') THEN
    ALTER TABLE "ReferralPartner" ADD CONSTRAINT "ReferralPartner_staffId_fkey"
      FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReferralCommission_payslipId_fkey') THEN
    ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_payslipId_fkey"
      FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
