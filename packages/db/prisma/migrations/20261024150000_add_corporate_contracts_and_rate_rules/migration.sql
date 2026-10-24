-- Additive contract/rule schema. Intentionally unapplied during design and rollout review.

CREATE TABLE "CorporateContract" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "corporateAccountId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "defaultCurrency" TEXT NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'PAY_LATER',
    "fallbackPolicy" TEXT NOT NULL DEFAULT 'NONE',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CorporateContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorporateContractProperty" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    CONSTRAINT "CorporateContractProperty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorporateContractVersion" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "termsSnapshot" JSONB,
    "submittedBy" UUID,
    "submittedAt" TIMESTAMPTZ,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorporateContractVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorporateRateRule" (
    "id" UUID NOT NULL,
    "contractVersionId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "sourceRatePlanId" UUID,
    "rateMethod" TEXT NOT NULL,
    "amount" DECIMAL(18,4),
    "discountPercent" DECIMAL(9,4),
    "currency" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "minAdults" INTEGER NOT NULL DEFAULT 1,
    "maxAdults" INTEGER,
    "minChildren" INTEGER NOT NULL DEFAULT 0,
    "maxChildren" INTEGER,
    "minOccupancy" INTEGER NOT NULL DEFAULT 1,
    "maxOccupancy" INTEGER,
    "minStay" INTEGER NOT NULL DEFAULT 1,
    "maxStay" INTEGER,
    "minLeadTimeHours" INTEGER NOT NULL DEFAULT 0,
    "maxAdvanceDays" INTEGER,
    "minRooms" INTEGER NOT NULL DEFAULT 1,
    "maxRooms" INTEGER,
    "weekdays" INTEGER[] NOT NULL,
    "blackoutDates" DATE[] NOT NULL,
    "fallbackAllowed" BOOLEAN NOT NULL DEFAULT false,
    "pricingFactors" JSONB,
    "inclusions" JSONB,
    "taxTreatment" JSONB,
    "cancellationPolicyId" UUID,
    "depositPolicyId" UUID,
    "noShowPolicyId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorporateRateRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorporateRateNegotiationRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "corporateAccountId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requestedByType" TEXT NOT NULL DEFAULT 'CORPORATE',
    "requestedById" TEXT,
    "reference" TEXT,
    "requestedTerms" JSONB NOT NULL,
    "proposedRates" JSONB NOT NULL,
    "reviewerNotes" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMPTZ,
    "resultingContractId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CorporateRateNegotiationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiPartnerCorporateAccount" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "corporateAccountId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "scopes" TEXT[] NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "ApiPartnerCorporateAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CorporateContract_organizationId_reference_key"
    ON "CorporateContract"("organizationId", "reference");
CREATE INDEX "CorporateContract_corporateAccountId_status_effectiveFrom_effectiveTo_idx"
    ON "CorporateContract"("corporateAccountId", "status", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "CorporateContractProperty_contractId_propertyId_key"
    ON "CorporateContractProperty"("contractId", "propertyId");
CREATE INDEX "CorporateContractProperty_propertyId_status_effectiveFrom_effectiveTo_idx"
    ON "CorporateContractProperty"("propertyId", "status", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "CorporateContractVersion_contractId_version_key"
    ON "CorporateContractVersion"("contractId", "version");
CREATE INDEX "CorporateContractVersion_contractId_status_effectiveFrom_effectiveTo_idx"
    ON "CorporateContractVersion"("contractId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "CorporateRateRule_propertyId_roomTypeId_priority_idx"
    ON "CorporateRateRule"("propertyId", "roomTypeId", "priority");
CREATE INDEX "CorporateRateRule_contractVersionId_priority_idx"
    ON "CorporateRateRule"("contractVersionId", "priority");
CREATE INDEX "CorporateRateNegotiationRequest_propertyId_corporateAccountId_status_idx"
    ON "CorporateRateNegotiationRequest"("propertyId", "corporateAccountId", "status");
CREATE INDEX "CorporateRateNegotiationRequest_organizationId_status_createdAt_idx"
    ON "CorporateRateNegotiationRequest"("organizationId", "status", "createdAt");
CREATE UNIQUE INDEX "ApiPartnerCorporateAccount_partnerId_corporateAccountId_propertyId_key"
    ON "ApiPartnerCorporateAccount"("partnerId", "corporateAccountId", "propertyId");
CREATE INDEX "ApiPartnerCorporateAccount_partnerId_propertyId_status_effectiveFrom_effectiveTo_idx"
    ON "ApiPartnerCorporateAccount"("partnerId", "propertyId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "ApiPartnerCorporateAccount_corporateAccountId_propertyId_status_idx"
    ON "ApiPartnerCorporateAccount"("corporateAccountId", "propertyId", "status");

ALTER TABLE "CorporateContract"
    ADD CONSTRAINT "CorporateContract_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CorporateContract"
    ADD CONSTRAINT "CorporateContract_corporateAccountId_fkey"
    FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CorporateContractProperty"
    ADD CONSTRAINT "CorporateContractProperty_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "CorporateContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporateContractProperty"
    ADD CONSTRAINT "CorporateContractProperty_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CorporateContractVersion"
    ADD CONSTRAINT "CorporateContractVersion_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "CorporateContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporateRateRule"
    ADD CONSTRAINT "CorporateRateRule_contractVersionId_fkey"
    FOREIGN KEY ("contractVersionId") REFERENCES "CorporateContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporateRateRule"
    ADD CONSTRAINT "CorporateRateRule_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CorporateRateRule"
    ADD CONSTRAINT "CorporateRateRule_roomTypeId_fkey"
    FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CorporateRateRule"
    ADD CONSTRAINT "CorporateRateRule_sourceRatePlanId_fkey"
    FOREIGN KEY ("sourceRatePlanId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CorporateRateRule"
    ADD CONSTRAINT "CorporateRateRule_cancellationPolicyId_fkey"
    FOREIGN KEY ("cancellationPolicyId") REFERENCES "CancellationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CorporateRateRule"
    ADD CONSTRAINT "CorporateRateRule_depositPolicyId_fkey"
    FOREIGN KEY ("depositPolicyId") REFERENCES "DepositPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CorporateRateRule"
    ADD CONSTRAINT "CorporateRateRule_noShowPolicyId_fkey"
    FOREIGN KEY ("noShowPolicyId") REFERENCES "NoShowPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CorporateRateNegotiationRequest"
    ADD CONSTRAINT "CorporateRateNegotiationRequest_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporateRateNegotiationRequest"
    ADD CONSTRAINT "CorporateRateNegotiationRequest_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporateRateNegotiationRequest"
    ADD CONSTRAINT "CorporateRateNegotiationRequest_corporateAccountId_fkey"
    FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporateRateNegotiationRequest"
    ADD CONSTRAINT "CorporateRateNegotiationRequest_resultingContractId_fkey"
    FOREIGN KEY ("resultingContractId") REFERENCES "CorporateContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiPartnerCorporateAccount"
    ADD CONSTRAINT "ApiPartnerCorporateAccount_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "ApiPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiPartnerCorporateAccount"
    ADD CONSTRAINT "ApiPartnerCorporateAccount_corporateAccountId_fkey"
    FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiPartnerCorporateAccount"
    ADD CONSTRAINT "ApiPartnerCorporateAccount_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiPartnerCorporateAccount"
    ADD CONSTRAINT "ApiPartnerCorporateAccount_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
