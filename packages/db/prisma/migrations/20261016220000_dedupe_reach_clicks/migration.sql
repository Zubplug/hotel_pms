ALTER TABLE "ReferralClick" ADD COLUMN IF NOT EXISTS "visitorId" TEXT;
CREATE INDEX IF NOT EXISTS "ReferralClick_campaign_visitor_occurred_idx"
  ON "ReferralClick"("campaignId", "visitorId", "occurredAt");
