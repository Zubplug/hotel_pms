-- Complete the employee loan and salary advance maker-checker workflow.
BEGIN;

ALTER TABLE "EmployeeLoan"
  ADD COLUMN IF NOT EXISTS "requestedBy" UUID,
  ADD COLUMN IF NOT EXISTS "rejectedBy" UUID,
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

ALTER TABLE "SalaryAdvance"
  ADD COLUMN IF NOT EXISTS "requestedBy" UUID,
  ADD COLUMN IF NOT EXISTS "rejectedBy" UUID,
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE INDEX IF NOT EXISTS "EmployeeLoan_propertyId_status_createdAt_idx"
  ON "EmployeeLoan"("propertyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "SalaryAdvance_propertyId_status_createdAt_idx"
  ON "SalaryAdvance"("propertyId", "status", "createdAt");

COMMIT;
