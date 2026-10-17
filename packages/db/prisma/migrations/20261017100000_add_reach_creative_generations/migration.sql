CREATE TABLE "ReachCreativeGeneration" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "campaignId" UUID,
    "idempotencyKey" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "outputUrl" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ReachCreativeGeneration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReachCreativeGeneration_idempotencyKey_key" ON "ReachCreativeGeneration"("idempotencyKey");
CREATE INDEX "ReachCreativeGeneration_partnerId_createdAt_idx" ON "ReachCreativeGeneration"("partnerId", "createdAt");
CREATE INDEX "ReachCreativeGeneration_propertyId_status_createdAt_idx" ON "ReachCreativeGeneration"("propertyId", "status", "createdAt");

ALTER TABLE "ReachCreativeGeneration" ADD CONSTRAINT "ReachCreativeGeneration_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReachCreativeGeneration" ADD CONSTRAINT "ReachCreativeGeneration_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReachCreativeGeneration" ADD CONSTRAINT "ReachCreativeGeneration_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReachCreativeGeneration" ADD CONSTRAINT "ReachCreativeGeneration_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
