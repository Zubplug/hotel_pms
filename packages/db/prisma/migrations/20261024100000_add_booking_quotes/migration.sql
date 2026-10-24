CREATE TABLE "BookingQuote" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "principalId" TEXT NOT NULL,
    "corporateAccountId" UUID,
    "requestFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "consumedAt" TIMESTAMPTZ,
    "invalidatedAt" TIMESTAMPTZ,
    "reservationId" UUID,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BookingQuote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingQuote_principalId_propertyId_status_expiresAt_idx"
    ON "BookingQuote"("principalId", "propertyId", "status", "expiresAt");
CREATE INDEX "BookingQuote_organizationId_propertyId_requestFingerprint_idx"
    ON "BookingQuote"("organizationId", "propertyId", "requestFingerprint");
CREATE INDEX "BookingQuote_corporateAccountId_status_expiresAt_idx"
    ON "BookingQuote"("corporateAccountId", "status", "expiresAt");

ALTER TABLE "BookingQuote"
    ADD CONSTRAINT "BookingQuote_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingQuote"
    ADD CONSTRAINT "BookingQuote_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
