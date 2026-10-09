ALTER TABLE "PurchaseOrder"
  ADD COLUMN "approvalStage" TEXT DEFAULT 'ACCOUNTANT',
  ADD COLUMN "accountantApprovedBy" UUID,
  ADD COLUMN "accountantApprovedAt" TIMESTAMPTZ,
  ADD COLUMN "generalManagerApprovedBy" UUID,
  ADD COLUMN "generalManagerApprovedAt" TIMESTAMPTZ;

UPDATE "PurchaseOrder"
SET "approvalStage" = NULL
WHERE "status" IN ('APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED', 'REJECTED');
