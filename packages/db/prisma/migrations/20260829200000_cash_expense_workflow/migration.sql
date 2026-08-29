-- Controlled General Cashier expense workflow and operational journal.
ALTER TABLE "CashAccount"
  ADD COLUMN IF NOT EXISTS "bankName" TEXT,
  ADD COLUMN IF NOT EXISTS "accountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BankDeposit"
  ADD COLUMN IF NOT EXISTS "bankAccountId" UUID;

DO $$ BEGIN
  ALTER TABLE "BankDeposit"
    ADD CONSTRAINT "BankDeposit_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "CashAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CashExpense" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "expenseReference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "amount" DECIMAL(18,4) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "payee" TEXT NOT NULL,
  "receiptUrl" TEXT,
  "costCenter" TEXT,
  "requestedBy" UUID NOT NULL,
  "approvedBy" UUID,
  "paidBy" UUID,
  "cashAccountId" UUID,
  "approvalNotes" TEXT,
  "rejectionReason" TEXT,
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMPTZ,
  "rejectedAt" TIMESTAMPTZ,
  "paidAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashExpense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashExpense_expenseReference_key" UNIQUE ("expenseReference"),
  CONSTRAINT "CashExpense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CashExpense_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CashExpense_propertyId_status_idx" ON "CashExpense"("propertyId", "status");
CREATE INDEX IF NOT EXISTS "CashExpense_propertyId_createdAt_idx" ON "CashExpense"("propertyId", "createdAt");

CREATE TABLE IF NOT EXISTS "CashExpenseJournal" (
  "id" UUID NOT NULL,
  "expenseId" UUID NOT NULL,
  "debitAccount" TEXT NOT NULL,
  "creditAccount" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "postedBy" UUID NOT NULL,
  "postedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashExpenseJournal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashExpenseJournal_expenseId_key" UNIQUE ("expenseId"),
  CONSTRAINT "CashExpenseJournal_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "CashExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CashExpenseJournal_postedAt_idx" ON "CashExpenseJournal"("postedAt");

CREATE TABLE IF NOT EXISTS "CashExpenseAudit" (
  "id" UUID NOT NULL,
  "expenseId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "performedBy" UUID NOT NULL,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashExpenseAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashExpenseAudit_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "CashExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CashExpenseAudit_expenseId_createdAt_idx" ON "CashExpenseAudit"("expenseId", "createdAt");
