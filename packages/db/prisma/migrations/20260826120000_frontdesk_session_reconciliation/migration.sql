ALTER TYPE "PosCashMovementType" ADD VALUE IF NOT EXISTS 'OPENING_FLOAT';
ALTER TYPE "PosCashMovementType" ADD VALUE IF NOT EXISTS 'PAYMENT';
ALTER TYPE "PosCashMovementType" ADD VALUE IF NOT EXISTS 'REFUND';
ALTER TYPE "PosCashMovementType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';

CREATE TYPE "FrontdeskSessionStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED', 'UNDER_REVIEW', 'RECONCILED', 'REOPEN_REQUESTED');

CREATE TABLE "FrontdeskSession" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "cashAccountId" UUID NOT NULL,
    "shiftReference" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "status" "FrontdeskSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingFloat" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "systemExpectedCash" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "declaredCash" DECIMAL(18,4),
    "variance" DECIMAL(18,4),
    "openedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingAt" TIMESTAMPTZ,
    "closedAt" TIMESTAMPTZ,
    "reconciledAt" TIMESTAMPTZ,
    "reconciledBy" UUID,
    "reconciliationDecision" TEXT,
    "reconciliationNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "FrontdeskSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FrontdeskSessionAudit" (
    "id" UUID NOT NULL,
    "frontdeskSessionId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" UUID NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FrontdeskSessionAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationException" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "frontdeskSessionId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "amount" DECIMAL(18,4),
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedBy" UUID,
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReconciliationException_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment" ADD COLUMN "frontdeskSessionId" UUID;
ALTER TABLE "Payment" ADD COLUMN "terminalId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "reference" TEXT;
ALTER TABLE "Payment" ADD COLUMN "authorizationCode" TEXT;
ALTER TABLE "PosCashMovement" ADD COLUMN "frontdeskSessionId" UUID;

CREATE UNIQUE INDEX "FrontdeskSession_shiftReference_key" ON "FrontdeskSession"("shiftReference");
CREATE INDEX "FrontdeskSession_propertyId_businessDate_idx" ON "FrontdeskSession"("propertyId", "businessDate");
CREATE INDEX "FrontdeskSession_staffId_status_idx" ON "FrontdeskSession"("staffId", "status");
CREATE INDEX "FrontdeskSession_cashAccountId_status_idx" ON "FrontdeskSession"("cashAccountId", "status");
CREATE INDEX "FrontdeskSessionAudit_frontdeskSessionId_createdAt_idx" ON "FrontdeskSessionAudit"("frontdeskSessionId", "createdAt");
CREATE INDEX "ReconciliationException_propertyId_status_idx" ON "ReconciliationException"("propertyId", "status");
CREATE INDEX "ReconciliationException_frontdeskSessionId_status_idx" ON "ReconciliationException"("frontdeskSessionId", "status");
CREATE INDEX "Payment_frontdeskSessionId_idx" ON "Payment"("frontdeskSessionId");
CREATE INDEX "PosCashMovement_frontdeskSessionId_idx" ON "PosCashMovement"("frontdeskSessionId");

ALTER TABLE "FrontdeskSession" ADD CONSTRAINT "FrontdeskSession_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FrontdeskSession" ADD CONSTRAINT "FrontdeskSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FrontdeskSession" ADD CONSTRAINT "FrontdeskSession_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FrontdeskSessionAudit" ADD CONSTRAINT "FrontdeskSessionAudit_frontdeskSessionId_fkey" FOREIGN KEY ("frontdeskSessionId") REFERENCES "FrontdeskSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FrontdeskSessionAudit" ADD CONSTRAINT "FrontdeskSessionAudit_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReconciliationException" ADD CONSTRAINT "ReconciliationException_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReconciliationException" ADD CONSTRAINT "ReconciliationException_frontdeskSessionId_fkey" FOREIGN KEY ("frontdeskSessionId") REFERENCES "FrontdeskSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_frontdeskSessionId_fkey" FOREIGN KEY ("frontdeskSessionId") REFERENCES "FrontdeskSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosCashMovement" ADD CONSTRAINT "PosCashMovement_frontdeskSessionId_fkey" FOREIGN KEY ("frontdeskSessionId") REFERENCES "FrontdeskSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
