-- Adds configurable property bank accounts for deposit submission.
-- Safe to run after the cash-expense workflow migration.

ALTER TABLE "CashAccount"
  ADD COLUMN IF NOT EXISTS "bankName" TEXT,
  ADD COLUMN IF NOT EXISTS "accountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BankDeposit"
  ADD COLUMN IF NOT EXISTS "bankAccountId" UUID;

DO $$ BEGIN
  ALTER TABLE "BankDeposit"
    ADD CONSTRAINT "BankDeposit_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId")
    REFERENCES "CashAccount"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CashAccount_propertyId_type_isDefault_idx"
  ON "CashAccount"("propertyId", "type", "isDefault");
