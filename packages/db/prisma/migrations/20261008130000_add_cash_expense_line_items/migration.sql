CREATE TABLE "CashExpenseLineItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "expenseId" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "unit" TEXT,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unitPrice" DECIMAL(18,4) NOT NULL,
  "total" DECIMAL(18,4) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashExpenseLineItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashExpenseLineItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "CashExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CashExpenseLineItem_expenseId_idx" ON "CashExpenseLineItem"("expenseId");
