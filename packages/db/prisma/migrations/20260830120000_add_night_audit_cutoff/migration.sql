-- Records the point at which the auditor begins the controlled close.
ALTER TABLE "NightAudit"
  ADD COLUMN IF NOT EXISTS "cutoffAt" TIMESTAMPTZ;
