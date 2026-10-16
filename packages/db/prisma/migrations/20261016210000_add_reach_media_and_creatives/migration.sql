CREATE TABLE IF NOT EXISTS "ReachPropertyMedia" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "roomTypeId" UUID,
  "hallId" UUID,
  "kind" TEXT NOT NULL DEFAULT 'PROPERTY',
  "url" TEXT NOT NULL,
  "altText" TEXT,
  "storageKey" TEXT,
  "mimeType" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReachPropertyMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReachPropertyMedia_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReachPropertyMedia_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReachPropertyMedia_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "Hall"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ReachPropertyMedia_property_status_idx" ON "ReachPropertyMedia"("propertyId", "kind", "status", "sortOrder");
CREATE INDEX IF NOT EXISTS "ReachPropertyMedia_room_status_idx" ON "ReachPropertyMedia"("roomTypeId", "status");
CREATE INDEX IF NOT EXISTS "ReachPropertyMedia_hall_status_idx" ON "ReachPropertyMedia"("hallId", "status");

CREATE TABLE IF NOT EXISTS "ReachCreativeAsset" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "campaignId" UUID,
  "title" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "mimeType" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "validFrom" TIMESTAMPTZ,
  "validUntil" TIMESTAMPTZ,
  "usageNotes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReachCreativeAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReachCreativeAsset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReachCreativeAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ReachCreativeAsset_property_status_idx" ON "ReachCreativeAsset"("propertyId", "status", "validUntil");
CREATE INDEX IF NOT EXISTS "ReachCreativeAsset_campaign_status_idx" ON "ReachCreativeAsset"("campaignId", "status");
