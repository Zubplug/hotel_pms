-- LodgeCore catalog modules and metered usage.

CREATE TABLE IF NOT EXISTS "Module" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Module_code_key" ON "Module"("code");
CREATE INDEX IF NOT EXISTS "Module_productId_active_idx" ON "Module"("productId", "active");

CREATE TABLE IF NOT EXISTS "Usage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "metric" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unit" TEXT,
  "periodStart" TIMESTAMPTZ(3) NOT NULL,
  "periodEnd" TIMESTAMPTZ(3) NOT NULL,
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Usage_organizationId_metric_periodStart_periodEnd_idx" ON "Usage"("organizationId", "metric", "periodStart", "periodEnd");
CREATE UNIQUE INDEX IF NOT EXISTS "Usage_organizationId_metric_periodStart_periodEnd_source_key" ON "Usage"("organizationId", "metric", "periodStart", "periodEnd", "source");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Module_productId_fkey') THEN
    ALTER TABLE "Module" ADD CONSTRAINT "Module_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Usage_organizationId_fkey') THEN
    ALTER TABLE "Usage" ADD CONSTRAINT "Usage_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
