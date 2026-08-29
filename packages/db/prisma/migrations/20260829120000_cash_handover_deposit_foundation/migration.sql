-- Financial custody records used by the handover and deposit dashboards.
-- This migration is intentionally additive and safe to run after the shift
-- control foundation migration.

DO $$ BEGIN
  CREATE TYPE "HandoverStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BankDepositStatus" AS ENUM (
    'DRAFT', 'PENDING_HANDOVER', 'HANDED_OVER', 'DEPOSITED',
    'UNDER_RECONCILIATION', 'RECONCILED', 'EXCEPTION', 'CANCELLED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PosSession"
  ADD COLUMN IF NOT EXISTS "cashHandoverId" UUID;

ALTER TABLE "FrontdeskSession"
  ADD COLUMN IF NOT EXISTS "cashHandoverId" UUID;

CREATE TABLE IF NOT EXISTS "CashHandover" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "handoverReference" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "amount" DECIMAL(18,4) NOT NULL,
  "handedOverById" UUID NOT NULL,
  "receivedById" UUID,
  "witnessedById" UUID,
  "safeReference" TEXT,
  "status" "HandoverStatus" NOT NULL DEFAULT 'PENDING',
  "handedOverAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMPTZ,
  "notes" TEXT,
  CONSTRAINT "CashHandover_pkey" PRIMARY KEY ("id")
);

-- The table may already exist from an earlier handover implementation.
ALTER TABLE "CashHandover"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CashHandover_idempotencyKey_key"
  ON "CashHandover"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "BankDeposit" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "depositReference" TEXT NOT NULL,
  "status" "BankDepositStatus" NOT NULL DEFAULT 'DRAFT',
  "expectedAmount" DECIMAL(18,4) NOT NULL,
  "declaredAmount" DECIMAL(18,4),
  "bankConfirmedAmount" DECIMAL(18,4),
  "difference" DECIMAL(18,4),
  "bankName" TEXT,
  "bankAccount" TEXT,
  "depositDate" TIMESTAMPTZ,
  "createdById" UUID NOT NULL,
  "submittedById" UUID,
  "verifiedById" UUID,
  "reconciledById" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMPTZ,
  "depositedAt" TIMESTAMPTZ,
  "verifiedAt" TIMESTAMPTZ,
  "reconciledAt" TIMESTAMPTZ,
  "bankReceiptUrl" TEXT,
  "bankReference" TEXT,
  "notes" TEXT,
  CONSTRAINT "BankDeposit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BankDepositAllocation" (
  "id" UUID NOT NULL,
  "bankDepositId" UUID NOT NULL,
  "posSessionId" UUID,
  "frontdeskSessionId" UUID,
  "allocatedAmount" DECIMAL(18,4) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankDepositAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankDeposit_depositReference_key"
  ON "BankDeposit"("depositReference");
CREATE UNIQUE INDEX IF NOT EXISTS "BankDepositAllocation_posSessionId_frontdeskSessionId_key"
  ON "BankDepositAllocation"("posSessionId", "frontdeskSessionId");

DO $$ BEGIN
  ALTER TABLE "PosSession"
    ADD CONSTRAINT "PosSession_cashHandoverId_fkey"
    FOREIGN KEY ("cashHandoverId") REFERENCES "CashHandover"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FrontdeskSession"
    ADD CONSTRAINT "FrontdeskSession_cashHandoverId_fkey"
    FOREIGN KEY ("cashHandoverId") REFERENCES "CashHandover"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashHandover"
    ADD CONSTRAINT "CashHandover_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashHandover"
    ADD CONSTRAINT "CashHandover_handedOverById_fkey"
    FOREIGN KEY ("handedOverById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashHandover"
    ADD CONSTRAINT "CashHandover_receivedById_fkey"
    FOREIGN KEY ("receivedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BankDeposit"
    ADD CONSTRAINT "BankDeposit_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BankDepositAllocation"
    ADD CONSTRAINT "BankDepositAllocation_bankDepositId_fkey"
    FOREIGN KEY ("bankDepositId") REFERENCES "BankDeposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BankDepositAllocation"
    ADD CONSTRAINT "BankDepositAllocation_posSessionId_fkey"
    FOREIGN KEY ("posSessionId") REFERENCES "PosSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BankDepositAllocation"
    ADD CONSTRAINT "BankDepositAllocation_frontdeskSessionId_fkey"
    FOREIGN KEY ("frontdeskSessionId") REFERENCES "FrontdeskSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
