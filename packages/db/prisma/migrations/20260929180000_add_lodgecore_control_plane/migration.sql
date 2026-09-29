-- LodgeCore SaaS control plane additions.
-- Forward-only migration. Review against the production schema before deploy.

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "planId" UUID;

CREATE TABLE IF NOT EXISTS "BillingPlan" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingPlan_code_key" ON "BillingPlan"("code");

CREATE TABLE IF NOT EXISTS "BillingPlanItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "planId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "includedQty" INTEGER,
  "metadata" JSONB,
  CONSTRAINT "BillingPlanItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingPlanItem_planId_productId_key" ON "BillingPlanItem"("planId", "productId");
CREATE INDEX IF NOT EXISTS "BillingPlanItem_productId_idx" ON "BillingPlanItem"("productId");

CREATE TABLE IF NOT EXISTS "SalesLead" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID,
  "source" TEXT NOT NULL DEFAULT 'WEBSITE',
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "company" TEXT,
  "propertyName" TEXT,
  "location" TEXT,
  "roomCount" INTEGER,
  "message" TEXT,
  "consentAt" TIMESTAMPTZ(3),
  "sourceCampaign" TEXT,
  "idempotencyKey" TEXT,
  "assignedTo" TEXT,
  "convertedAt" TIMESTAMPTZ(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesLead_idempotencyKey_key" ON "SalesLead"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "SalesLead_email_createdAt_idx" ON "SalesLead"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "SalesLead_status_createdAt_idx" ON "SalesLead"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SalesLead_organizationId_idx" ON "SalesLead"("organizationId");

CREATE TABLE IF NOT EXISTS "Proposal" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID,
  "leadId" UUID,
  "number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "subtotal" INTEGER NOT NULL DEFAULT 0,
  "tax" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "validUntil" TIMESTAMPTZ(3),
  "notes" TEXT,
  "lineItems" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Proposal_number_key" ON "Proposal"("number");
CREATE INDEX IF NOT EXISTS "Proposal_organizationId_status_idx" ON "Proposal"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Proposal_leadId_idx" ON "Proposal"("leadId");

CREATE TABLE IF NOT EXISTS "ImplementationProject" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DISCOVERY',
  "ownerId" TEXT,
  "targetGoLiveAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImplementationProject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ImplementationProject_organizationId_status_idx" ON "ImplementationProject"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "PropertySetup" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "roomCount" INTEGER,
  "completedAt" TIMESTAMPTZ(3),
  "checklist" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertySetup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PropertySetup_projectId_propertyId_key" ON "PropertySetup"("projectId", "propertyId");
CREATE INDEX IF NOT EXISTS "PropertySetup_propertyId_status_idx" ON "PropertySetup"("propertyId", "status");

CREATE TABLE IF NOT EXISTS "DataMigration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "sourceSystem" TEXT,
  "recordCounts" JSONB,
  "errorSummary" TEXT,
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataMigration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DataMigration_projectId_status_idx" ON "DataMigration"("projectId", "status");

CREATE TABLE IF NOT EXISTS "Training" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "topic" TEXT NOT NULL,
  "scheduledAt" TIMESTAMPTZ(3),
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "attendeeCount" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Training_projectId_scheduledAt_idx" ON "Training"("projectId", "scheduledAt");

CREATE TABLE IF NOT EXISTS "HardwareInventory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "propertyId" UUID,
  "category" TEXT NOT NULL,
  "brand" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
  "warrantyEndsAt" TIMESTAMPTZ(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HardwareInventory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HardwareInventory_organizationId_serialNumber_key" ON "HardwareInventory"("organizationId", "serialNumber");
CREATE INDEX IF NOT EXISTS "HardwareInventory_organizationId_category_status_idx" ON "HardwareInventory"("organizationId", "category", "status");
CREATE INDEX IF NOT EXISTS "HardwareInventory_propertyId_idx" ON "HardwareInventory"("propertyId");

CREATE TABLE IF NOT EXISTS "HardwareInstallation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "propertyId" UUID,
  "inventoryId" UUID,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "installationType" TEXT NOT NULL,
  "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "installer" TEXT,
  "notes" TEXT,
  "siteInfo" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HardwareInstallation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HardwareInstallation_organizationId_status_idx" ON "HardwareInstallation"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "HardwareInstallation_propertyId_scheduledAt_idx" ON "HardwareInstallation"("propertyId", "scheduledAt");

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "requesterEmail" TEXT NOT NULL,
  "assignee" TEXT,
  "slaDueAt" TIMESTAMPTZ(3),
  "resolvedAt" TIMESTAMPTZ(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_number_key" ON "SupportTicket"("number");
CREATE INDEX IF NOT EXISTS "SupportTicket_organizationId_status_priority_idx" ON "SupportTicket"("organizationId", "status", "priority");

CREATE TABLE IF NOT EXISTS "IntegrationDefinition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "setupSchema" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationDefinition_slug_key" ON "IntegrationDefinition"("slug");

CREATE TABLE IF NOT EXISTS "InstalledIntegration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "definitionId" UUID NOT NULL,
  "propertyId" UUID,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "credentialsRef" TEXT,
  "config" JSONB,
  "lastSyncAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstalledIntegration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstalledIntegration_organizationId_definitionId_propertyId_key" ON "InstalledIntegration"("organizationId", "definitionId", "propertyId");
CREATE INDEX IF NOT EXISTS "InstalledIntegration_organizationId_status_idx" ON "InstalledIntegration"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "PortalApiKey" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMPTZ(3),
  "expiresAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PortalApiKey_prefix_key" ON "PortalApiKey"("prefix");
CREATE INDEX IF NOT EXISTS "PortalApiKey_organizationId_revokedAt_idx" ON "PortalApiKey"("organizationId", "revokedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_planId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillingPlanItem_planId_fkey') THEN
    ALTER TABLE "BillingPlanItem" ADD CONSTRAINT "BillingPlanItem_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillingPlanItem_productId_fkey') THEN
    ALTER TABLE "BillingPlanItem" ADD CONSTRAINT "BillingPlanItem_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesLead_organizationId_fkey') THEN
    ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Proposal_organizationId_fkey') THEN
    ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Proposal_leadId_fkey') THEN
    ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ImplementationProject_organizationId_fkey') THEN
    ALTER TABLE "ImplementationProject" ADD CONSTRAINT "ImplementationProject_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertySetup_projectId_fkey') THEN
    ALTER TABLE "PropertySetup" ADD CONSTRAINT "PropertySetup_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "ImplementationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertySetup_propertyId_fkey') THEN
    ALTER TABLE "PropertySetup" ADD CONSTRAINT "PropertySetup_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DataMigration_projectId_fkey') THEN
    ALTER TABLE "DataMigration" ADD CONSTRAINT "DataMigration_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "ImplementationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Training_projectId_fkey') THEN
    ALTER TABLE "Training" ADD CONSTRAINT "Training_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "ImplementationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HardwareInventory_organizationId_fkey') THEN
    ALTER TABLE "HardwareInventory" ADD CONSTRAINT "HardwareInventory_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HardwareInventory_propertyId_fkey') THEN
    ALTER TABLE "HardwareInventory" ADD CONSTRAINT "HardwareInventory_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HardwareInstallation_organizationId_fkey') THEN
    ALTER TABLE "HardwareInstallation" ADD CONSTRAINT "HardwareInstallation_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HardwareInstallation_propertyId_fkey') THEN
    ALTER TABLE "HardwareInstallation" ADD CONSTRAINT "HardwareInstallation_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HardwareInstallation_inventoryId_fkey') THEN
    ALTER TABLE "HardwareInstallation" ADD CONSTRAINT "HardwareInstallation_inventoryId_fkey"
      FOREIGN KEY ("inventoryId") REFERENCES "HardwareInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicket_organizationId_fkey') THEN
    ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationDefinition_organizationId_fkey') THEN
    ALTER TABLE "IntegrationDefinition" ADD CONSTRAINT "IntegrationDefinition_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstalledIntegration_organizationId_fkey') THEN
    ALTER TABLE "InstalledIntegration" ADD CONSTRAINT "InstalledIntegration_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstalledIntegration_definitionId_fkey') THEN
    ALTER TABLE "InstalledIntegration" ADD CONSTRAINT "InstalledIntegration_definitionId_fkey"
      FOREIGN KEY ("definitionId") REFERENCES "IntegrationDefinition"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstalledIntegration_propertyId_fkey') THEN
    ALTER TABLE "InstalledIntegration" ADD CONSTRAINT "InstalledIntegration_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PortalApiKey_organizationId_fkey') THEN
    ALTER TABLE "PortalApiKey" ADD CONSTRAINT "PortalApiKey_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
