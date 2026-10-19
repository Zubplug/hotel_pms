-- Provider-neutral subscription identity and one-lifetime-trial guarantee.
-- This migration is additive and safe for existing paid subscriptions.

ALTER TABLE "Subscription"
  ALTER COLUMN "flutterwaveSubscriptionId" DROP NOT NULL;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "internalReference" TEXT;

UPDATE "Subscription"
SET "internalReference" = gen_random_uuid()::text
WHERE "internalReference" IS NULL;

ALTER TABLE "Subscription"
  ALTER COLUMN "internalReference" SET NOT NULL,
  ALTER COLUMN "internalReference" SET DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_internalReference_key"
  ON "Subscription"("internalReference");

CREATE INDEX IF NOT EXISTS "Subscription_status_trialEndsAt_idx"
  ON "Subscription"("status", "trialEndsAt");

CREATE TABLE IF NOT EXISTS "TrialHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "subscriptionId" UUID NOT NULL,
  "planCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'STARTED',
  "startedAt" TIMESTAMPTZ NOT NULL,
  "endedAt" TIMESTAMPTZ,
  "source" TEXT NOT NULL DEFAULT 'SELF_SERVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrialHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrialHistory_organizationId_key" UNIQUE ("organizationId"),
  CONSTRAINT "TrialHistory_subscriptionId_key" UNIQUE ("subscriptionId"),
  CONSTRAINT "TrialHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TrialHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TrialHistory_status_endedAt_idx"
  ON "TrialHistory"("status", "endedAt");

-- Preserve eligibility for trials created before this migration. A non-null
-- trialEndsAt is the durable signal that a subscription participated in a
-- trial; paid subscriptions with that field are treated as converted.
INSERT INTO "TrialHistory" (
  "organizationId", "subscriptionId", "planCode", "status", "startedAt", "endedAt", "source", "metadata"
)
SELECT
  s."organizationId",
  s."id",
  COALESCE(p."code", 'UNKNOWN'),
  CASE
    WHEN s."status" = 'TRIALING' AND s."trialEndsAt" > CURRENT_TIMESTAMP THEN 'STARTED'
    WHEN s."status" = 'TRIALING' THEN 'EXPIRED'
    WHEN s."status" IN ('ACTIVE', 'PAST_DUE') THEN 'CONVERTED'
    ELSE 'EXPIRED'
  END,
  s."currentPeriodStart",
  CASE
    WHEN s."status" = 'TRIALING' AND s."trialEndsAt" > CURRENT_TIMESTAMP THEN NULL
    ELSE COALESCE(s."trialEndsAt", s."currentPeriodEnd")
  END,
  'MIGRATION_BACKFILL',
  jsonb_build_object('source', 'pre_trial_history_migration')
FROM "Subscription" s
LEFT JOIN "BillingPlan" p ON p."id" = s."planId"
WHERE s."trialEndsAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "TrialHistory" h
    WHERE h."organizationId" = s."organizationId"
       OR h."subscriptionId" = s."id"
  )
ON CONFLICT DO NOTHING;
