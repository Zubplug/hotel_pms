-- Entitlement quantities/lifecycle and subscription payment grace period.

ALTER TABLE "Entitlement"
  ADD COLUMN IF NOT EXISTS "quantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "pastDueSince" TIMESTAMPTZ(3);

CREATE INDEX IF NOT EXISTS "Subscription_organizationId_status_pastDueSince_idx"
  ON "Subscription"("organizationId", "status", "pastDueSince");
