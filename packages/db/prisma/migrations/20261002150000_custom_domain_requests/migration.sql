CREATE TABLE IF NOT EXISTS "CustomDomainRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "domain" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "amount" INTEGER NOT NULL DEFAULT 0,
  "billingPriceId" UUID,
  "checkoutRef" TEXT,
  "requestedByEmail" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMPTZ,
  "paidAt" TIMESTAMPTZ,
  "activatedAt" TIMESTAMPTZ,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CustomDomainRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomDomainRequest_property_domain_key" UNIQUE ("propertyId", "domain"),
  CONSTRAINT "CustomDomainRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "CustomDomainRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "CustomDomainRequest_org_status_idx" ON "CustomDomainRequest"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomDomainRequest_property_status_idx" ON "CustomDomainRequest"("propertyId", "status");
