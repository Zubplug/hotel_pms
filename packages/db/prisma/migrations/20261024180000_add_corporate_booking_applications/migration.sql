-- Additive corporate website/API application lifecycle.
-- Intentionally unapplied until staging review and explicit rollout approval.

CREATE TABLE "CorporateBookingApplication" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMode" TEXT NOT NULL,
    "requestedCurrency" TEXT NOT NULL,
    "sourceChannel" TEXT NOT NULL,
    "principalId" TEXT,
    "accessTokenHash" TEXT,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "corporateAccountId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CorporateBookingApplication_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookingQuote" ADD COLUMN "corporateBookingApplicationId" UUID;
ALTER TABLE "Reservation" ADD COLUMN "corporateBookingApplicationId" UUID;
ALTER TABLE "CorporatePaymentGroup" ADD COLUMN "corporateBookingApplicationId" UUID;
ALTER TABLE "CorporatePaymentGroup" ALTER COLUMN "corporateAccountId" DROP NOT NULL;
ALTER TABLE "CorporateContract" ADD COLUMN "corporateBookingApplicationId" UUID;
ALTER TABLE "CorporateContract" ALTER COLUMN "corporateAccountId" DROP NOT NULL;
ALTER TABLE "CorporateRateNegotiationRequest" ADD COLUMN "corporateBookingApplicationId" UUID;
ALTER TABLE "CorporateRateNegotiationRequest" ALTER COLUMN "corporateAccountId" DROP NOT NULL;

CREATE UNIQUE INDEX "CorporateBookingApplication_accessTokenHash_key" ON "CorporateBookingApplication"("accessTokenHash");
CREATE INDEX "CorporateBookingApplication_organizationId_propertyId_status_expiresAt_idx" ON "CorporateBookingApplication"("organizationId", "propertyId", "status", "expiresAt");
CREATE INDEX "CorporateBookingApplication_propertyId_contactEmail_status_idx" ON "CorporateBookingApplication"("propertyId", "contactEmail", "status");
CREATE INDEX "BookingQuote_corporateBookingApplicationId_status_expiresAt_idx" ON "BookingQuote"("corporateBookingApplicationId", "status", "expiresAt");
CREATE INDEX "Reservation_corporateBookingApplicationId_status_paymentExpiresAt_idx" ON "Reservation"("corporateBookingApplicationId", "status", "paymentExpiresAt");
CREATE INDEX "CorporatePaymentGroup_corporateBookingApplicationId_status_idx" ON "CorporatePaymentGroup"("corporateBookingApplicationId", "status");
CREATE INDEX "CorporateContract_corporateBookingApplicationId_status_effectiveFrom_effectiveTo_idx" ON "CorporateContract"("corporateBookingApplicationId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "CorporateRateNegotiationRequest_propertyId_corporateBookingApplicationId_status_idx" ON "CorporateRateNegotiationRequest"("propertyId", "corporateBookingApplicationId", "status");

ALTER TABLE "CorporateBookingApplication" ADD CONSTRAINT "CorporateBookingApplication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporateBookingApplication" ADD CONSTRAINT "CorporateBookingApplication_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporateBookingApplication" ADD CONSTRAINT "CorporateBookingApplication_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingQuote" ADD CONSTRAINT "BookingQuote_corporateBookingApplicationId_fkey" FOREIGN KEY ("corporateBookingApplicationId") REFERENCES "CorporateBookingApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_corporateBookingApplicationId_fkey" FOREIGN KEY ("corporateBookingApplicationId") REFERENCES "CorporateBookingApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CorporatePaymentGroup" ADD CONSTRAINT "CorporatePaymentGroup_corporateBookingApplicationId_fkey" FOREIGN KEY ("corporateBookingApplicationId") REFERENCES "CorporateBookingApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CorporateContract" ADD CONSTRAINT "CorporateContract_corporateBookingApplicationId_fkey" FOREIGN KEY ("corporateBookingApplicationId") REFERENCES "CorporateBookingApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CorporateRateNegotiationRequest" ADD CONSTRAINT "CorporateRateNegotiationRequest_corporateBookingApplicationId_fkey" FOREIGN KEY ("corporateBookingApplicationId") REFERENCES "CorporateBookingApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every commercial identity must resolve to exactly one lifecycle owner.
ALTER TABLE "CorporateContract" ADD CONSTRAINT "CorporateContract_exactly_one_identity_ck" CHECK (("corporateAccountId" IS NOT NULL) <> ("corporateBookingApplicationId" IS NOT NULL));
ALTER TABLE "CorporateRateNegotiationRequest" ADD CONSTRAINT "CorporateRateNegotiationRequest_exactly_one_identity_ck" CHECK (("corporateAccountId" IS NOT NULL) <> ("corporateBookingApplicationId" IS NOT NULL));
ALTER TABLE "CorporatePaymentGroup" ADD CONSTRAINT "CorporatePaymentGroup_exactly_one_identity_ck" CHECK (("corporateAccountId" IS NOT NULL) <> ("corporateBookingApplicationId" IS NOT NULL));
