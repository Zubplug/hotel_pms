-- Controlled, property- and period-scoped access for independent auditors.
CREATE TYPE "ExternalAuditorAccessStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TABLE "ExternalAuditorAccess" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "auditPeriodStart" DATE NOT NULL,
    "auditPeriodEnd" DATE NOT NULL,
    "accessStartsAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessExpiresAt" TIMESTAMPTZ NOT NULL,
    "status" "ExternalAuditorAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedByUserId" UUID NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "revokedByUserId" UUID,
    "revocationReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalAuditorAccess_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExternalAuditorAccess_period_check" CHECK ("auditPeriodEnd" >= "auditPeriodStart"),
    CONSTRAINT "ExternalAuditorAccess_expiry_check" CHECK ("accessExpiresAt" > "accessStartsAt")
);

CREATE INDEX "ExternalAuditorAccess_userId_status_idx" ON "ExternalAuditorAccess"("userId", "status");
CREATE INDEX "ExternalAuditorAccess_propertyId_auditPeriodStart_auditPeriodEnd_idx" ON "ExternalAuditorAccess"("propertyId", "auditPeriodStart", "auditPeriodEnd");
CREATE INDEX "ExternalAuditorAccess_organizationId_propertyId_idx" ON "ExternalAuditorAccess"("organizationId", "propertyId");

ALTER TABLE "ExternalAuditorAccess" ADD CONSTRAINT "ExternalAuditorAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalAuditorAccess" ADD CONSTRAINT "ExternalAuditorAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalAuditorAccess" ADD CONSTRAINT "ExternalAuditorAccess_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalAuditorAccess" ADD CONSTRAINT "ExternalAuditorAccess_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalAuditorAccess" ADD CONSTRAINT "ExternalAuditorAccess_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "external_auditor_access_updated_at"() RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExternalAuditorAccess_updatedAt_trigger"
BEFORE UPDATE ON "ExternalAuditorAccess"
FOR EACH ROW EXECUTE FUNCTION "external_auditor_access_updated_at"();
