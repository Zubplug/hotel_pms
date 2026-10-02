CREATE TABLE IF NOT EXISTS "CustomWebsiteRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "amount" INTEGER NOT NULL DEFAULT 0,
  "billingPriceId" UUID,
  "checkoutRef" TEXT,
  "requestedByEmail" TEXT,
  "brief" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMPTZ,
  "paidAt" TIMESTAMPTZ,
  "activatedAt" TIMESTAMPTZ,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CustomWebsiteRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomWebsiteRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "CustomWebsiteRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "CustomWebsiteRequest_org_status_idx" ON "CustomWebsiteRequest"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomWebsiteRequest_property_status_idx" ON "CustomWebsiteRequest"("propertyId", "status");
