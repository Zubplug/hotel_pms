-- Additive hardening for enterprise HR & payroll.
-- Existing Staff, SalaryStructure, PayrollPeriod and Payslip rows are preserved.
BEGIN;

ALTER TABLE "StatutoryConfiguration"
  ADD COLUMN IF NOT EXISTS "minimumWageFloor" NUMERIC(18, 4) NOT NULL DEFAULT 70000;

ALTER TABLE "Payslip"
  ADD COLUMN IF NOT EXISTS "bvn" TEXT,
  ADD COLUMN IF NOT EXISTS "tin" TEXT,
  ADD COLUMN IF NOT EXISTS "rsaPin" TEXT,
  ADD COLUMN IF NOT EXISTS "pfaName" TEXT;

CREATE TABLE IF NOT EXISTS "SalaryStructureVersion" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "basicSalary" NUMERIC(18, 4) NOT NULL,
  "housingAllowance" NUMERIC(18, 4) NOT NULL DEFAULT 0,
  "transportAllowance" NUMERIC(18, 4) NOT NULL DEFAULT 0,
  "otherAllowances" NUMERIC(18, 4) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "bankName" TEXT,
  "bankAccountNumber" TEXT,
  "bankSortCode" TEXT,
  "pensionFundAdmin" TEXT,
  "pensionNumber" TEXT,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "SalaryStructureVersion_staff_dates_idx"
  ON "SalaryStructureVersion"("staffId", "effectiveFrom", "effectiveTo");
CREATE INDEX IF NOT EXISTS "SalaryStructureVersion_tenant_dates_idx"
  ON "SalaryStructureVersion"("organizationId", "propertyId", "effectiveFrom");

-- Backfill one immutable version from every legacy current structure. The
-- legacy row remains untouched for backward compatibility.
INSERT INTO "SalaryStructureVersion" (
  "organizationId", "propertyId", "staffId", "basicSalary",
  "housingAllowance", "transportAllowance", "otherAllowances", "currency",
  "bankName", "bankAccountNumber", "bankSortCode", "pensionFundAdmin",
  "pensionNumber", "effectiveFrom", "effectiveTo", "createdBy"
)
SELECT s."organizationId", s."propertyId", s."staffId", s."basicSalary",
       s."housingAllowance", s."transportAllowance", s."otherAllowances", s."currency",
       s."bankName", s."bankAccountNumber", s."bankSortCode", s."pensionFundAdmin",
       s."pensionNumber", s."effectiveFrom", s."effectiveTo", s."createdBy"
FROM "SalaryStructure" s
WHERE NOT EXISTS (
  SELECT 1 FROM "SalaryStructureVersion" v
  WHERE v."staffId" = s."staffId" AND v."effectiveFrom" = s."effectiveFrom"
);

CREATE TABLE IF NOT EXISTS "PolicyAcknowledgement" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "policyId" UUID NOT NULL REFERENCES "CompanyPolicy"("id") ON DELETE CASCADE,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "acknowledgedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "PolicyAcknowledgement_policyId_staffId_key" UNIQUE ("policyId", "staffId")
);
CREATE INDEX IF NOT EXISTS "PolicyAcknowledgement_staffId_acknowledgedAt_idx"
  ON "PolicyAcknowledgement"("staffId", "acknowledgedAt");

ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "bankSortCode" TEXT;
ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT;
ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "bankVerifiedAt" TIMESTAMPTZ;
ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "bankVerificationReference" TEXT;
ALTER TABLE "BookingPaymentAccount" ADD COLUMN IF NOT EXISTS "payrollEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "PayrollPayout" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "payrollPeriodId" UUID NOT NULL REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE,
  "payslipId" UUID NOT NULL UNIQUE REFERENCES "Payslip"("id") ON DELETE CASCADE,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL DEFAULT 'FLUTTERWAVE',
  "providerReference" TEXT NOT NULL UNIQUE,
  "providerTransferId" TEXT,
  "providerBatchId" TEXT,
  "providerStatus" TEXT,
  "amount" DECIMAL(18,4) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "failureReason" TEXT,
  "rawResponse" JSONB,
  "initiatedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PayrollPayout_organizationId_propertyId_status_idx"
  ON "PayrollPayout"("organizationId", "propertyId", "status");
CREATE INDEX IF NOT EXISTS "PayrollPayout_payrollPeriodId_status_idx"
  ON "PayrollPayout"("payrollPeriodId", "status");
CREATE INDEX IF NOT EXISTS "PayrollPayout_providerTransferId_idx"
  ON "PayrollPayout"("providerTransferId");

COMMIT;
