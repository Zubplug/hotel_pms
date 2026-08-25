ALTER TABLE "RefundRequest"
ADD COLUMN "currentApprovalStep" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "RefundApproval"
ADD COLUMN "stepOrder" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "RefundApprovalRule" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "stepOrder" INTEGER NOT NULL,
  "minAmount" DECIMAL(18,4),
  "maxAmount" DECIMAL(18,4),
  "roleId" UUID,
  "approverId" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundApprovalRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefundApprovalRule_propertyId_stepOrder_key"
ON "RefundApprovalRule"("propertyId", "stepOrder");

CREATE INDEX "RefundApprovalRule_propertyId_isActive_idx"
ON "RefundApprovalRule"("propertyId", "isActive");

ALTER TABLE "RefundApprovalRule"
ADD CONSTRAINT "RefundApprovalRule_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RefundApprovalRule"
ADD CONSTRAINT "RefundApprovalRule_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RefundApprovalRule"
ADD CONSTRAINT "RefundApprovalRule_approverId_fkey"
FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
