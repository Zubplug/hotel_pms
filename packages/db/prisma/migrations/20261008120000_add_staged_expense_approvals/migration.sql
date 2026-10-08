ALTER TABLE "CashExpense"
  ADD COLUMN "currentApprovalStage" TEXT,
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "paymentReference" TEXT;

CREATE TABLE "CashExpenseApproval" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "expenseId" UUID NOT NULL,
  "stage" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approverId" UUID,
  "notes" TEXT,
  "actedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashExpenseApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashExpenseApproval_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "CashExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CashExpenseApproval_expenseId_stage_key" ON "CashExpenseApproval"("expenseId", "stage");
CREATE INDEX "CashExpenseApproval_expenseId_status_idx" ON "CashExpenseApproval"("expenseId", "status");
CREATE INDEX "CashExpenseApproval_stage_status_idx" ON "CashExpenseApproval"("stage", "status");

INSERT INTO "CashExpenseApproval" ("expenseId", "stage", "status", "approverId", "actedAt")
SELECT "id", stage, CASE WHEN "status" IN ('APPROVED', 'PAID') THEN 'APPROVED' WHEN "status" = 'REJECTED' THEN 'REJECTED' ELSE 'PENDING' END, "approvedBy", CASE WHEN "status" IN ('APPROVED', 'PAID') THEN "approvedAt" ELSE NULL END
FROM "CashExpense"
CROSS JOIN (VALUES ('GENERAL_CASHIER'), ('ACCOUNTANT'), ('GENERAL_MANAGER')) AS stages(stage)
ON CONFLICT ("expenseId", "stage") DO NOTHING;

UPDATE "CashExpense"
SET "currentApprovalStage" = CASE WHEN "status" = 'PENDING_APPROVAL' THEN 'GENERAL_CASHIER' ELSE NULL END
WHERE "currentApprovalStage" IS NULL;
