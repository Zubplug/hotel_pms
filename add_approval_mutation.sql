-- CreateTable
CREATE TABLE "ApprovalMutation" (
    "id" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "approvalId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,

    CONSTRAINT "ApprovalMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalMutation_idempotencyKey_key" ON "ApprovalMutation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ApprovalMutation_idempotencyKey_idx" ON "ApprovalMutation"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "ApprovalMutation" ADD CONSTRAINT "ApprovalMutation_approvalId_fkey" 
  FOREIGN KEY ("approvalId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
