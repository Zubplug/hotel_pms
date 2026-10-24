CREATE TABLE "ApiPartner" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "environment" TEXT NOT NULL DEFAULT 'LIVE',
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "requestSizeLimitBytes" INTEGER NOT NULL DEFAULT 1048576,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "ApiPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiPartnerProperty" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiPartnerProperty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiCredential" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'LIVE',
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "lastUsedAt" TIMESTAMPTZ,
    "lastUsedIp" TEXT,
    "rotatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiPartnerProperty_partnerId_propertyId_key" ON "ApiPartnerProperty"("partnerId", "propertyId");
CREATE UNIQUE INDEX "ApiCredential_prefix_key" ON "ApiCredential"("prefix");
CREATE INDEX "ApiPartner_organizationId_status_idx" ON "ApiPartner"("organizationId", "status");
CREATE INDEX "ApiPartner_organizationId_environment_status_idx" ON "ApiPartner"("organizationId", "environment", "status");
CREATE INDEX "ApiPartnerProperty_propertyId_idx" ON "ApiPartnerProperty"("propertyId");
CREATE INDEX "ApiCredential_partnerId_status_idx" ON "ApiCredential"("partnerId", "status");
CREATE INDEX "ApiCredential_prefix_status_idx" ON "ApiCredential"("prefix", "status");

ALTER TABLE "ApiPartner" ADD CONSTRAINT "ApiPartner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiPartnerProperty" ADD CONSTRAINT "ApiPartnerProperty_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ApiPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiPartnerProperty" ADD CONSTRAINT "ApiPartnerProperty_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ApiPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
