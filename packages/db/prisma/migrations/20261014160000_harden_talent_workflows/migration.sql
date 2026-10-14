-- Harden recruitment requisition maker-checker records.
BEGIN;

ALTER TABLE "JobRequisition"
  ADD COLUMN IF NOT EXISTS "createdBy" UUID,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE INDEX IF NOT EXISTS "JobRequisition_propertyId_status_createdAt_idx"
  ON "JobRequisition"("propertyId", "status", "createdAt");

COMMIT;
