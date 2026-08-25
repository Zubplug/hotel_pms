ALTER TABLE "FolioCredit"
  ADD COLUMN "approvalId" TEXT,
  ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED';

ALTER TABLE "FolioCreditApplication"
  ADD COLUMN "approvalId" TEXT;

ALTER TABLE "ApprovalRequest"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "ApprovalRequest_idempotencyKey_key"
ON "ApprovalRequest"("idempotencyKey");

CREATE TABLE "FinancialAuditLog" (
    "id" UUID NOT NULL,
    "operationId" TEXT NOT NULL,
    "approvalId" TEXT,
    "propertyId" UUID NOT NULL,
    "reservationId" TEXT,
    "folioId" TEXT,
    "guestId" TEXT,
    "creditId" TEXT,
    "creditApplicationId" TEXT,
    "transactionId" TEXT,
    "operationType" TEXT NOT NULL,
    "amount" DECIMAL(18,4),
    "currency" TEXT,
    "operatorId" TEXT,
    "operatorRole" TEXT,
    "deviceId" TEXT,
    "terminalId" TEXT,
    "businessDate" DATE NOT NULL,
    "reason" TEXT,
    "balanceBefore" DECIMAL(18,4),
    "balanceAfter" DECIMAL(18,4),
    "approvalStatus" TEXT NOT NULL,
    "approverId" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupervisorOverride" (
    "id" UUID NOT NULL,
    "operationId" TEXT NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" TEXT,
    "folioId" TEXT,
    "transactionId" TEXT,
    "operatorId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(18,4),
    "currency" TEXT,
    "deviceId" TEXT,
    "terminalId" TEXT,
    "approvalId" TEXT,
    "businessDate" DATE NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupervisorOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialAuditLog_idempotencyKey_key" ON "FinancialAuditLog"("idempotencyKey");
CREATE UNIQUE INDEX "SupervisorOverride_idempotencyKey_key" ON "SupervisorOverride"("idempotencyKey");
CREATE INDEX "FinancialAuditLog_propertyId_createdAt_idx" ON "FinancialAuditLog"("propertyId", "createdAt");
CREATE INDEX "FinancialAuditLog_folioId_createdAt_idx" ON "FinancialAuditLog"("folioId", "createdAt");
CREATE INDEX "FinancialAuditLog_operationId_idx" ON "FinancialAuditLog"("operationId");
CREATE INDEX "SupervisorOverride_propertyId_createdAt_idx" ON "SupervisorOverride"("propertyId", "createdAt");
CREATE INDEX "SupervisorOverride_operatorId_createdAt_idx" ON "SupervisorOverride"("operatorId", "createdAt");
CREATE INDEX "SupervisorOverride_supervisorId_createdAt_idx" ON "SupervisorOverride"("supervisorId", "createdAt");
