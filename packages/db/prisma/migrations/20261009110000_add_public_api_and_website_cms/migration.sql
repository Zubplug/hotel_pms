CREATE TABLE IF NOT EXISTS "PropertyIntegration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'LODGECORE_CMS',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PropertyIntegration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "PropertyIntegration_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE,
  CONSTRAINT "PropertyIntegration_status_check" CHECK ("status" IN ('ACTIVE', 'SUSPENDED'))
);
CREATE INDEX IF NOT EXISTS "PropertyIntegration_propertyId_idx" ON "PropertyIntegration"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyIntegration_organizationId_idx" ON "PropertyIntegration"("organizationId");

CREATE TABLE IF NOT EXISTS "PublishableKey" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "integrationId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'LIVE',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "allowedOrigins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lastUsedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PublishableKey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublishableKey_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "PropertyIntegration"("id") ON DELETE CASCADE,
  CONSTRAINT "PublishableKey_key_key" UNIQUE ("key"),
  CONSTRAINT "PublishableKey_environment_check" CHECK ("environment" IN ('TEST', 'LIVE')),
  CONSTRAINT "PublishableKey_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED'))
);
CREATE INDEX IF NOT EXISTS "PublishableKey_integrationId_status_idx" ON "PublishableKey"("integrationId", "status");

CREATE TABLE IF NOT EXISTS "WebsiteProject" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "name" TEXT NOT NULL,
  "customDomain" TEXT UNIQUE,
  "customDomainVerifiedAt" TIMESTAMPTZ,
  "customDomainVerificationToken" TEXT UNIQUE,
  "primaryColor" TEXT,
  "secondaryColor" TEXT,
  "logoUrl" TEXT,
  "faviconUrl" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "socialLinks" JSONB,
  "seoMetadata" JSONB,
  "activeRevisionId" UUID,
  "previewRevisionId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "WebsiteProject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "WebsiteProject_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE,
  CONSTRAINT "WebsiteProject_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'SUSPENDED'))
);
CREATE INDEX IF NOT EXISTS "WebsiteProject_propertyId_idx" ON "WebsiteProject"("propertyId");
CREATE INDEX IF NOT EXISTS "WebsiteProject_organizationId_idx" ON "WebsiteProject"("organizationId");

CREATE TABLE IF NOT EXISTS "WebsiteRevision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "versionName" TEXT NOT NULL,
  "publishedAt" TIMESTAMPTZ,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "WebsiteRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE CASCADE,
  CONSTRAINT "WebsiteRevision_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);
CREATE INDEX IF NOT EXISTS "WebsiteRevision_projectId_status_idx" ON "WebsiteRevision"("projectId", "status");
ALTER TABLE "WebsiteProject" ADD CONSTRAINT "WebsiteProject_activeRevisionId_fkey" FOREIGN KEY ("activeRevisionId") REFERENCES "WebsiteRevision"("id") ON DELETE SET NULL;
ALTER TABLE "WebsiteProject" ADD CONSTRAINT "WebsiteProject_previewRevisionId_fkey" FOREIGN KEY ("previewRevisionId") REFERENCES "WebsiteRevision"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "WebsitePage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "revisionId" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "WebsitePage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsitePage_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "WebsiteRevision"("id") ON DELETE CASCADE,
  CONSTRAINT "WebsitePage_revisionId_slug_key" UNIQUE ("revisionId", "slug")
);

CREATE TABLE IF NOT EXISTS "WebsiteSection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "pageId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "WebsiteSection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WebsitePage"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "WebsiteSection_pageId_sortOrder_idx" ON "WebsiteSection"("pageId", "sortOrder");

CREATE TABLE IF NOT EXISTS "WebsiteAsset" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "altText" TEXT,
  "fileSize" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "WebsiteAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "WebsiteAsset_projectId_idx" ON "WebsiteAsset"("projectId");
