-- Reconcile NightAudit with the current Prisma model.
-- This is intentionally idempotent because some environments created the
-- original table before the Night Audit fields and constraints were added.

ALTER TABLE "NightAudit"
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "runReference" TEXT,
  ADD COLUMN IF NOT EXISTS "tasksCreated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tasksSkipped" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "errors" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "posUnresolvedVariances" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "posSessionsPending" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "NightAudit_runReference_key"
  ON "NightAudit"("runReference");

CREATE UNIQUE INDEX IF NOT EXISTS "NightAudit_propertyId_businessDate_key"
  ON "NightAudit"("propertyId", "businessDate");

ALTER TABLE "FolioItem"
  ADD COLUMN IF NOT EXISTS "nightAuditRunId" UUID;

DO $$ BEGIN
  ALTER TABLE "FolioItem" ADD CONSTRAINT "FolioItem_nightAuditRunId_fkey"
    FOREIGN KEY ("nightAuditRunId") REFERENCES "NightAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "FolioItem_nightAuditRunId_idx"
  ON "FolioItem"("nightAuditRunId");

CREATE TABLE IF NOT EXISTS "NightAuditAcknowledgement" (
  "id" UUID NOT NULL,
  "nightAuditId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "warningType" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "comment" TEXT,
  "acknowledgedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NightAuditAcknowledgement_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "NightAuditAcknowledgement" ADD CONSTRAINT "NightAuditAcknowledgement_nightAuditId_fkey"
    FOREIGN KEY ("nightAuditId") REFERENCES "NightAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "NightAuditAcknowledgement_nightAuditId_idx"
  ON "NightAuditAcknowledgement"("nightAuditId");
