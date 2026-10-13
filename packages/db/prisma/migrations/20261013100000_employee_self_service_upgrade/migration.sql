-- Employee self-service profile change workflow.
-- Additive only: existing Staff and EmployeeProfile records are preserved.
BEGIN;

CREATE TABLE IF NOT EXISTS "EmployeeChangeRequest" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "fieldName" TEXT NOT NULL,
  "currentValue" TEXT,
  "proposedValue" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedBy" UUID NOT NULL,
  "reviewedBy" UUID,
  "reviewedAt" TIMESTAMPTZ,
  "reviewerNotes" TEXT,
  "effectiveAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "EmployeeChangeRequest_staffId_status_createdAt_idx"
  ON "EmployeeChangeRequest"("staffId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "EmployeeChangeRequest_status_createdAt_idx"
  ON "EmployeeChangeRequest"("status", "createdAt");

COMMIT;
