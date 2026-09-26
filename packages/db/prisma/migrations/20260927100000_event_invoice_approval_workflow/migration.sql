ALTER TABLE "EventInvoice"
  ADD COLUMN "workflowStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "requestedDiscount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountReason" TEXT,
  ADD COLUMN "submittedBy" UUID,
  ADD COLUMN "submittedAt" TIMESTAMPTZ,
  ADD COLUMN "reviewedBy" UUID,
  ADD COLUMN "reviewedAt" TIMESTAMPTZ,
  ADD COLUMN "approvedBy" UUID,
  ADD COLUMN "approvedAt" TIMESTAMPTZ,
  ADD COLUMN "rejectedBy" UUID,
  ADD COLUMN "rejectedAt" TIMESTAMPTZ,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "issuedBy" UUID,
  ADD COLUMN "issuedAt" TIMESTAMPTZ,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Preserve the meaning of invoices created before the approval workflow existed.
-- They have already passed issuance and must remain payable/syncable offline.
UPDATE "EventInvoice"
SET "workflowStatus" = 'ISSUED'
WHERE "status" IN ('UNPAID', 'PARTIAL', 'PAID');

CREATE INDEX "EventInvoice_workflowStatus_idx" ON "EventInvoice"("workflowStatus");
CREATE INDEX "EventInvoice_eventId_workflowStatus_idx" ON "EventInvoice"("eventId", "workflowStatus");
