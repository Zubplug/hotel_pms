-- Configurable expense categories and cost centres for controlled cash expenses.

CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "debitAccount" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExpenseCategory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_propertyId_code_key" ON "ExpenseCategory"("propertyId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_propertyId_name_key" ON "ExpenseCategory"("propertyId", "name");
CREATE INDEX IF NOT EXISTS "ExpenseCategory_propertyId_isActive_idx" ON "ExpenseCategory"("propertyId", "isActive");

CREATE TABLE IF NOT EXISTS "CostCenter" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CostCenter_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CostCenter_propertyId_code_key" ON "CostCenter"("propertyId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "CostCenter_propertyId_name_key" ON "CostCenter"("propertyId", "name");
CREATE INDEX IF NOT EXISTS "CostCenter_propertyId_isActive_idx" ON "CostCenter"("propertyId", "isActive");

ALTER TABLE "CashExpense"
  ADD COLUMN IF NOT EXISTS "categoryId" UUID,
  ADD COLUMN IF NOT EXISTS "costCenterId" UUID;

DO $$ BEGIN
  ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_costCenterId_fkey"
    FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CashExpense_categoryId_idx" ON "CashExpense"("categoryId");
CREATE INDEX IF NOT EXISTS "CashExpense_costCenterId_idx" ON "CashExpense"("costCenterId");
