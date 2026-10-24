CREATE TABLE "CorporatePortalIdentity" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "corporateAccountId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CorporatePortalIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorporatePortalLoginToken" (
    "id" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorporatePortalLoginToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorporatePortalSession" (
    "id" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "lastUsedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorporatePortalSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CorporatePortalIdentity_corporateAccountId_key" ON "CorporatePortalIdentity"("corporateAccountId");
CREATE UNIQUE INDEX "CorporatePortalIdentity_propertyId_email_key" ON "CorporatePortalIdentity"("propertyId", "email");
CREATE UNIQUE INDEX "CorporatePortalLoginToken_tokenHash_key" ON "CorporatePortalLoginToken"("tokenHash");
CREATE UNIQUE INDEX "CorporatePortalSession_tokenHash_key" ON "CorporatePortalSession"("tokenHash");
CREATE INDEX "CorporatePortalIdentity_organizationId_propertyId_status_idx" ON "CorporatePortalIdentity"("organizationId", "propertyId", "status");
CREATE INDEX "CorporatePortalLoginToken_identityId_expiresAt_usedAt_idx" ON "CorporatePortalLoginToken"("identityId", "expiresAt", "usedAt");
CREATE INDEX "CorporatePortalSession_identityId_expiresAt_revokedAt_idx" ON "CorporatePortalSession"("identityId", "expiresAt", "revokedAt");

ALTER TABLE "CorporatePortalIdentity" ADD CONSTRAINT "CorporatePortalIdentity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporatePortalIdentity" ADD CONSTRAINT "CorporatePortalIdentity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporatePortalIdentity" ADD CONSTRAINT "CorporatePortalIdentity_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporatePortalLoginToken" ADD CONSTRAINT "CorporatePortalLoginToken_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "CorporatePortalIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporatePortalSession" ADD CONSTRAINT "CorporatePortalSession_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "CorporatePortalIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
